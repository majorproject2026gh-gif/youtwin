"""Bundled sample creator transcripts used when use_sample_data=True.
Lets a grader/demo run the full pipeline (M1-M4) with zero network access
and zero API keys."""

SAMPLE_VIDEOS = [
    {
        "video_id": "sample001",
        "title": "My Everyday Vlogging Camera Setup",
        "segments": [
            {"t": 0, "text": "Hey everyone, welcome back to the channel."},
            {"t": 5, "text": "So today I want to talk about the camera I actually use every single day."},
            {"t": 12, "text": "I switched to the Sony ZV-1 II back in March and honestly it changed my whole workflow."},
            {"t": 20, "text": "The autofocus is just ridiculous, it locks onto my face even when I'm walking backwards filming myself."},
            {"t": 30, "text": "For lighting I keep it super simple, one soft box and a reflector, nothing fancy."},
            {"t": 40, "text": "A lot of you ask about audio, I use a wireless lav mic clipped under my collar."},
            {"t": 50, "text": "That's basically my whole setup, let me know if you want a full breakdown video."},
        ],
    },
    {
        "video_id": "sample002",
        "title": "Q&A: Answering Your Camera Questions",
        "segments": [
            {"t": 0, "text": "Alright so this is a Q&A video, you guys sent in a ton of questions."},
            {"t": 8, "text": "First one, what camera do you recommend for someone just starting out vlogging?"},
            {"t": 15, "text": "Honestly for beginners I'd say the Sony ZV-1 II, it's the one I use in my March vlog and it just works out of the box."},
            {"t": 27, "text": "Second question, do I edit on my phone or laptop, and it's laptop, I use a pretty basic timeline cut."},
            {"t": 38, "text": "Third, how do I stay consistent posting, and honestly I just batch film on weekends."},
        ],
    },
    {
        "video_id": "sample003",
        "title": "A Day In My Life As A Content Creator",
        "segments": [
            {"t": 0, "text": "Good morning, let's get into it, today is a full filming day."},
            {"t": 10, "text": "I always start with coffee and going through my notes app for video ideas."},
            {"t": 18, "text": "Around 10am I set up the Sony ZV-1 II and just start rolling for a couple hours."},
            {"t": 28, "text": "I try to keep my tone pretty casual and honest with you guys, that's just how I talk."},
            {"t": 40, "text": "That's a wrap for today, thanks so much for watching, see you in the next one."},
        ],
    },
]
