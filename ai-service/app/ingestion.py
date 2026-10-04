"""
M1 - Multimodal Ingestion Module
Whisper-v3 (via faster-whisper) · Python

Connects to a creator's YouTube library, pulls official captions where
available, and falls back to downloading audio + transcribing it with
Whisper for full coverage.

Three ingestion modes are supported (matching the three demo paths this
project supports):
  1. captions_only   - youtube-transcript-api, no download, fastest, free
  2. full_pipeline    - yt-dlp audio download + faster-whisper transcription
  3. sample_data       - bundled mock transcripts, no network required at all
"""
from __future__ import annotations

import html
import re

import os
import tempfile
import logging
from dataclasses import dataclass, field
from typing import Callable

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

from .config import resolved_whisper_model, settings
from .sample_data import SAMPLE_VIDEOS

logger = logging.getLogger("youtwin.ingestion")

# Same rationale as embeddings.py — Google's API client also wraps
# network errors in its own exception classes, so a narrow type filter
# doesn't reliably match. Retry broadly on these idempotent read calls.
def _is_transient(exc: BaseException) -> bool:
    # Configuration / "not found" errors are raised as RuntimeError or
    # ValueError on purpose — retrying those just made a mistyped channel
    # handle (or a missing API key) hang for minutes before failing, since
    # the nested retries multiplied to ~25 attempts.
    return not isinstance(exc, (RuntimeError, ValueError))


network_retry = retry(
    retry=retry_if_exception(_is_transient),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)


def _fetch_video_title(video_id: str) -> str:
    """Real video title for citations. Captions don't carry one, so every
    captions-based citation used to show the raw 11-char video id as its
    "title" in the chat's side-by-side player. Uses YouTube's public
    oEmbed endpoint (no API key needed); falls back to the id."""
    try:
        import httpx

        resp = httpx.get(
            "https://www.youtube.com/oembed",
            params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
            timeout=8,
        )
        if resp.status_code == 200:
            title = (resp.json() or {}).get("title")
            if title:
                return str(title)
    except Exception as exc:
        logger.info("title lookup failed for %s: %s", video_id, exc)
    return video_id


_whisper_model = None


def _get_whisper_model():
    """Load the Whisper model once and reuse it — it was re-loaded from
    disk for every single video, adding seconds and a large memory spike
    per video on a memory-constrained host."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        _whisper_model = WhisperModel(
            resolved_whisper_model(), device=settings.whisper_device,
            compute_type="int8" if settings.whisper_device == "cpu" else "float16",
        )
    return _whisper_model


@dataclass
class TranscriptSegment:
    start_seconds: int
    text: str


@dataclass
class VideoTranscript:
    video_id: str
    title: str
    source: str  # "captions" | "whisper" | "sample"
    segments: list[TranscriptSegment] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        return " ".join(s.text for s in self.segments)


# ---------------------------------------------------------------- cleaning

# Non-speech caption tags ([Music], [Applause], (laughs), ♪) and speaker
# arrows (>>) carry no meaning but used to be embedded and quoted as if
# the creator had said them.
_NOISE_RE = re.compile(
    r"\[(?:[^\]]{0,30})\]"              # [Music], [Applause], [Laughter], [__]
    r"|\((?:music|applause|laughs?|laughter|cheering|inaudible|silence)\)"
    r"|[♪♫]+|>>+",
    re.IGNORECASE,
)
_SPACE_RE = re.compile(r"\s+")


def clean_caption_text(text: str) -> str:
    text = html.unescape(text or "").replace("\n", " ")
    return _SPACE_RE.sub(" ", _NOISE_RE.sub(" ", text)).strip()


def clean_transcript(t: VideoTranscript) -> VideoTranscript:
    """Drops non-speech tags and empty / repeated caption lines."""
    segments: list[TranscriptSegment] = []
    for seg in t.segments:
        text = clean_caption_text(seg.text)
        if not text or (segments and segments[-1].text.lower() == text.lower()):
            continue
        segments.append(TranscriptSegment(start_seconds=int(seg.start_seconds), text=text))
    t.segments = segments
    return t


@network_retry
def resolve_channel_id(channel_input: str) -> str:
    """Accepts whatever a real person is likely to paste — a raw channel
    ID (UCxxxx), a full channel URL (/channel/UCxxxx, /@handle, /c/Name,
    /user/Name), or a bare @handle — and resolves it to a canonical
    channel ID via the YouTube Data API. Raises if it can't be resolved."""
    raw = channel_input.strip()

    # Already a canonical channel ID
    if raw.startswith("UC") and len(raw) == 24:
        return raw

    # Pull the meaningful segment out of a full URL
    handle = raw
    for prefix in ("https://www.youtube.com/", "http://www.youtube.com/",
                   "https://youtube.com/", "http://youtube.com/", "www.youtube.com/"):
        if handle.startswith(prefix):
            handle = handle[len(prefix):]
            break
    handle = handle.strip("/").split("?")[0]

    if handle.startswith("channel/"):
        candidate = handle.split("/")[1]
        if candidate.startswith("UC"):
            return candidate

    if handle.startswith("@"):
        handle = handle[1:]
    elif handle.startswith(("c/", "user/")):
        handle = handle.split("/", 1)[1]

    if not settings.youtube_api_key:
        raise RuntimeError(
            "YOUTUBE_API_KEY not set — needed to resolve a channel handle/URL to an ID."
        )

    from googleapiclient.discovery import build
    youtube = build("youtube", "v3", developerKey=settings.youtube_api_key)

    # Try the modern forHandle lookup first (works for @handles)
    try:
        resp = youtube.channels().list(part="id", forHandle=handle).execute()
        items = resp.get("items", [])
        if items:
            return items[0]["id"]
    except Exception as exc:
        logger.info("forHandle lookup failed for %r: %s", handle, exc)

    # Fall back to legacy username lookup
    try:
        resp = youtube.channels().list(part="id", forUsername=handle).execute()
        items = resp.get("items", [])
        if items:
            return items[0]["id"]
    except Exception as exc:
        logger.info("forUsername lookup failed for %r: %s", handle, exc)

    # Last resort: search by name and take the top channel result
    resp = youtube.search().list(part="snippet", q=handle, type="channel", maxResults=1).execute()
    items = resp.get("items", [])
    if items:
        return items[0]["snippet"]["channelId"]

    raise RuntimeError(f"Could not resolve '{channel_input}' to a YouTube channel.")


@network_retry
def get_channel_video_ids(channel_id: str, max_videos: int = 6) -> list[str]:
    """Fetch recent video IDs for a channel using the YouTube Data API.
    Requires YOUTUBE_API_KEY. Raises if not configured."""
    if not settings.youtube_api_key:
        raise RuntimeError(
            "YOUTUBE_API_KEY not set. Either provide it in ai-service/.env, "
            "pass explicit video_urls, or use sample data."
        )
    from googleapiclient.discovery import build

    channel_id = resolve_channel_id(channel_id)
    youtube = build("youtube", "v3", developerKey=settings.youtube_api_key)
    resp = youtube.search().list(
        channelId=channel_id, part="id", order="date",
        maxResults=max_videos, type="video",
    ).execute()
    return [item["id"]["videoId"] for item in resp.get("items", [])]


def fetch_captions(video_id: str) -> VideoTranscript | None:
    """Try to pull official/auto-generated captions for a video. Returns
    None if no captions exist (caller should fall back to Whisper).

    Supports both the modern instance-based API (youtube-transcript-api
    >=1.0, `YouTubeTranscriptApi().fetch(video_id)`) and the legacy
    classmethod API (<1.0, `YouTubeTranscriptApi.get_transcript(video_id)`),
    so a dependency version drift degrades gracefully with a loud warning
    instead of silently failing every single video and forcing every
    ingestion down the far less reliable Whisper/yt-dlp path.
    """
    try:
        if hasattr(YouTubeTranscriptApi(), "list"):
            raw_segments = _fetch_best_transcript(video_id)
            if raw_segments is None:
                return None
            segments = [
                TranscriptSegment(start_seconds=int(s.start), text=s.text)
                for s in raw_segments
            ]
        elif hasattr(YouTubeTranscriptApi(), "fetch"):
            raw_segments = list(YouTubeTranscriptApi().fetch(video_id))
            segments = [
                TranscriptSegment(start_seconds=int(s.start), text=s.text)
                for s in raw_segments
            ]
        elif hasattr(YouTubeTranscriptApi, "get_transcript"):
            logger.warning(
                "youtube-transcript-api appears to be an old version (no "
                "instance .fetch() method) — falling back to the legacy "
                "get_transcript() API. Run: pip install -U youtube-transcript-api"
            )
            raw = YouTubeTranscriptApi.get_transcript(video_id)
            segments = [
                TranscriptSegment(start_seconds=int(row["start"]), text=row["text"])
                for row in raw
            ]
        else:
            raise RuntimeError(
                "youtube-transcript-api has neither .fetch() nor .get_transcript() "
                "— the installed version is incompatible. Run: "
                "pip install -U youtube-transcript-api"
            )
    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except Exception as exc:
        logger.warning("caption fetch failed for %s: %s", video_id, exc)
        return None

    return VideoTranscript(
        video_id=video_id, title=_fetch_video_title(video_id), source="captions", segments=segments
    )


_ENGLISH = ["en", "en-US", "en-GB", "en-IN", "en-CA", "en-AU"]


def _fetch_best_transcript(video_id: str):
    """Best available caption track, in order: English written by the
    creator, English auto-captions, any other track machine-translated to
    English by YouTube, then that track as-is. (A plain fetch() only ever
    tried English, so every Hindi or Marathi video fell through to the
    slow, less accurate Whisper path.)"""
    tracks = YouTubeTranscriptApi().list(video_id)
    for finder in (tracks.find_manually_created_transcript, tracks.find_generated_transcript):
        try:
            return list(finder(_ENGLISH).fetch())
        except NoTranscriptFound:
            continue
    others = sorted(tracks, key=lambda t: t.is_generated)   # creator-written first
    if not others:
        return None
    best = others[0]
    if best.is_translatable:
        try:
            return list(best.translate("en").fetch())
        except Exception as exc:
            logger.info("caption translation failed for %s (%s): %s", video_id, best.language_code, exc)
    return list(best.fetch())


def transcribe_with_whisper(video_url: str) -> VideoTranscript:
    """Download audio with yt-dlp and transcribe with faster-whisper
    (the local, free equivalent of "Whisper-v3" from the spec sheet).

    YouTube's bot-detection ("Please sign in") triggers most often on
    yt-dlp's anonymous extraction. We try, in order:
      1. Cookies pulled from the local Chrome browser — this makes the
         request look like it's coming from an actual signed-in browser
         session, which is the most reliable fix when it's available
         (requires the machine running this service to have a real
         Chrome profile logged into YouTube).
      2. The android/ios mobile player clients, which frequently aren't
         subject to the same web-client bot check.
      3. Plain web-client extraction as a last resort.
    """
    import yt_dlp

    with tempfile.TemporaryDirectory() as tmp:
        audio_path = os.path.join(tmp, "audio.%(ext)s")
        wav_path = os.path.join(tmp, "audio.wav")

        base_opts = {
            "format": "bestaudio/best",
            "outtmpl": audio_path,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }],
            "quiet": True,
        }

        attempts: list[dict] = [
            {**base_opts, "cookiesfrombrowser": ("chrome",)},
            {**base_opts, "extractor_args": {"youtube": {"player_client": ["android"]}}},
            {**base_opts, "extractor_args": {"youtube": {"player_client": ["ios"]}}},
            {**base_opts, "extractor_args": {"youtube": {"player_client": ["web"]}}},
        ]

        last_error: Exception | None = None
        info = None
        for ydl_opts in attempts:
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=True)
                break
            except Exception as exc:
                logger.warning("yt-dlp attempt failed for %s (%s): %s", video_url, ydl_opts.get("extractor_args") or "chrome cookies", exc)
                last_error = exc
                continue

        if info is None:
            raise last_error or RuntimeError(f"Could not download audio for {video_url}")

        video_id = info["id"]
        title = info.get("title", video_id)

        model = _get_whisper_model()
        # vad_filter skips music/silence (where Whisper invents text);
        # condition_on_previous_text=False stops one misheard line from
        # repeating itself for the rest of the video.
        segments_iter, _info = model.transcribe(
            wav_path, beam_size=5, vad_filter=True, condition_on_previous_text=False,
        )

        segments = [
            TranscriptSegment(start_seconds=int(seg.start), text=seg.text.strip())
            for seg in segments_iter
        ]
        return VideoTranscript(
            video_id=video_id, title=title, source="whisper", segments=segments
        )


def load_sample_videos() -> list[VideoTranscript]:
    """Bundled mock transcripts so the whole pipeline can be demoed with
    zero network access and zero API keys."""
    out = []
    for v in SAMPLE_VIDEOS:
        segments = [
            TranscriptSegment(start_seconds=s["t"], text=s["text"])
            for s in v["segments"]
        ]
        out.append(VideoTranscript(
            video_id=v["video_id"], title=v["title"], source="sample",
            segments=segments,
        ))
    return out


def _extract_video_id(url_or_id: str) -> str:
    """Pulls a bare 11-char video ID out of any real-world YouTube URL
    format. The previous version only handled watch?v=XXXX and silently
    passed everything else through unchanged — including youtu.be/XXXX
    short-links, which is what YouTube's own Share button generates, so
    that was a genuine, likely-to-be-hit bug, not an edge case."""
    s = url_or_id.strip()
    if "v=" in s:
        return s.split("v=")[-1].split("&")[0].split("#")[0]
    if "youtu.be/" in s:
        return s.split("youtu.be/")[-1].split("?")[0].split("&")[0]
    for marker in ("/shorts/", "/embed/", "/live/"):
        if marker in s:
            return s.split(marker)[-1].split("?")[0].split("&")[0].split("/")[0]
    # Already a bare ID (or an unrecognized format) — pass through as-is.
    return s


_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def _valid_video_id(url_or_id: str) -> str:
    """Only real 11-character YouTube ids get anywhere near yt-dlp or the
    transcript API — anything else is rejected instead of being passed
    through as a URL fragment."""
    vid = _extract_video_id(url_or_id)
    if not _VIDEO_ID_RE.match(vid):
        raise ValueError(f"Not a valid YouTube video link: {url_or_id[:80]!r}")
    return vid


def ingest(
    channel_id: str | None = None,
    video_urls: list[str] | None = None,
    use_sample_data: bool = False,
    on_progress: Callable[[int, int, str], None] | None = None,
) -> list[VideoTranscript]:
    """Top-level ingestion entrypoint. Tries captions first for every video,
    falls back to Whisper transcription, per the M1 spec ("When missing,
    it extracts raw audio and transcribes it with Whisper-v3")."""
    if use_sample_data:
        return [clean_transcript(t) for t in load_sample_videos()]

    ids: list[str] = []
    if channel_id:
        ids = get_channel_video_ids(channel_id)
        if not ids:
            raise ValueError(
                f"'{channel_id}' has no public videos to learn from yet. "
                "Upload at least one video, or use 'Load sample creator' to test with mock data."
            )
    elif video_urls:
        ids = [_valid_video_id(u) for u in video_urls]
    else:
        raise ValueError("Provide channel_id, video_urls, or use_sample_data=True")

    results: list[VideoTranscript] = []
    failures: list[str] = []
    def report(done: int, stage: str) -> None:
        if on_progress:
            try:
                on_progress(done, len(ids), stage)
            except Exception:
                pass  # progress reporting must never break ingestion

    for i, vid in enumerate(ids):
        try:
            transcript = fetch_captions(vid)
            if transcript is None:
                logger.info("no captions for %s, falling back to whisper", vid)
                report(i, "transcribing_audio")
                transcript = transcribe_with_whisper(f"https://youtube.com/watch?v={vid}")
            transcript = clean_transcript(transcript)
            if not transcript.segments:
                raise ValueError("no speech found in this video")
            results.append(transcript)
            report(i + 1, "fetching_captions")
        except Exception as exc:
            # A single video failing (YouTube bot-detection blocking the
            # audio download, an age-restricted/members-only video, a
            # transient network error, etc.) should not sink the whole
            # channel's training — skip it and keep going with the rest.
            logger.warning("skipping video %s after failure: %s", vid, exc)
            failures.append(vid)

    if not results:
        detail = f" ({len(failures)} video(s) failed: {', '.join(failures[:5])})" if failures else ""
        raise RuntimeError(
            f"Couldn't process any videos from this channel{detail}. This can happen if "
            "YouTube is blocking automated access to every video tried. Try again shortly, "
            "try a different channel, or use 'Load sample creator' to test with mock data."
        )

    if failures:
        logger.warning(
            "ingestion partially succeeded: %d/%d videos processed, skipped: %s",
            len(results), len(ids), ", ".join(failures),
        )

    return results
