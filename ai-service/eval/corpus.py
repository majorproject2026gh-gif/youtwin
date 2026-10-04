"""Evaluation corpus: four fictional creator videos written as natural
speech, then cut into YouTube auto-caption style segments (lower-case,
no punctuation, ~8 words, ~3 s apart, occasional [Music]) so the test
looks like what youtube-transcript-api really returns."""
import re

VIDEOS = {
"pcbuild01aa": ("I Built a Budget Gaming PC for 50,000 Rupees", """
[Music] hey guys welcome back to the channel so today we are finally doing the budget gaming PC build that so many of you asked for in the comments.
The total budget for this build was fifty thousand rupees and I managed to stay just under it at forty nine thousand six hundred.
Let's start with the processor. I went with the Ryzen 5 5600 because it's still the best value chip for gaming and it comes with a stock cooler that is honestly good enough.
For the graphics card I picked a used RTX 3060 twelve gigabyte from OLX for nineteen thousand rupees. Buying used is risky so I tested it with FurMark for thirty minutes before paying the seller.
The motherboard is a B550M from MSI, the micro ATX size, and I chose it mainly because it has a decent VRM and two M.2 slots for future upgrades.
Memory is sixteen gigs of DDR4 at 3200 megahertz in dual channel. Please always use two sticks, a single stick of RAM can cost you ten to fifteen percent of your frame rate.
Storage is a one terabyte NVMe SSD from Crucial. Load times in games are basically instant now compared to my old hard drive.
The power supply is a 550 watt bronze rated unit from Corsair. Never cheap out on the power supply, a bad one can take your whole system with it.
[Music] the case is the Ant Esports ICE-112 which has really good airflow with the mesh front and it came with four fans included.
Now the assembly. The trickiest part for me was the front panel connectors, those tiny power switch and LED pins. Check the motherboard manual, there is a diagram, don't guess.
I also forgot to install the IO shield first and had to take the motherboard out again, so learn from my mistake.
For cable management I routed everything behind the motherboard tray and used zip ties, it took about forty minutes but the airflow is much better.
After the first boot I went into the BIOS and turned on the XMP profile, otherwise your RAM will run at 2133 instead of 3200.
Then I installed Windows eleven from a USB pen drive and the latest Nvidia drivers.
Let's talk performance. In Valorant at 1080p I am getting around two hundred and forty frames per second on high settings.
In Cyberpunk 2077 at 1080p with medium settings and DLSS on quality I get about sixty five fps which is very playable.
GTA five on very high settings runs at around one hundred and ten fps.
Temperatures stayed below seventy two degrees on the GPU and around sixty eight on the CPU during long gaming sessions.
If you want to upgrade later, the first thing I would add is another sixteen gigs of RAM and then a bigger SSD.
That's it for this build. If you want the full parts list it is in the description. See you in the next one, bye.
"""),

"studyhab02b": ("How I Study 10 Hours a Day Without Burning Out", """
Hi everyone, in this video I am going to share exactly how I study for my engineering semester exams without burning out.
First thing, I don't actually study ten straight hours. I use the Pomodoro technique, but my version is fifty minutes of focus followed by a ten minute break.
After four of these blocks I take a longer break of around forty five minutes where I go for a walk or eat something.
My phone stays in another room during focus blocks. This single change improved my concentration more than any app.
I start the day with the hardest subject. For me that is usually Theory of Computation or Compiler Design, because my brain is freshest in the morning.
For notes I use the Cornell method. I divide the page into a cue column on the left, the main notes on the right, and a summary at the bottom.
The most important technique is active recall. Instead of rereading notes, I close the book and try to write down everything I remember, then I check what I missed.
I combine that with spaced repetition using Anki flashcards. I review cards for about twenty minutes every night before sleeping.
For numericals and problem solving subjects, I solve previous year question papers. I try to do at least the last five years for every subject.
People ask me about music. I don't listen to songs with lyrics while studying, I only play lo-fi beats or rain sounds at low volume.
Sleep is non negotiable for me. I sleep seven to eight hours, usually from eleven thirty at night to seven in the morning, even during exam week.
I also exercise for thirty minutes every evening, mostly skipping rope and push ups, because it really helps with stress.
When I feel burnt out I take a full day off on Sunday and I don't feel guilty about it.
For group study I meet my friends only for doubt solving, never for first time learning, because group study for new topics wastes a lot of time.
In the last week before exams I stop learning new things and only revise my summaries and flashcards.
My biggest mistake in first year was making beautiful colourful notes that took hours. They looked nice but I never revised them.
So if you take away one thing from this video, test yourself instead of rereading. Let me know in the comments what your study routine looks like.
"""),

"streetfd03c": ("Nagpur Street Food Tour Under 500 Rupees", """
[Music] namaste everyone and welcome to Nagpur. Today we are doing a street food tour and the challenge is to spend less than five hundred rupees in total.
Our first stop is Sitabuldi for tarri poha. This is Nagpur's famous poha served with a spicy chana curry on top called tarri. One plate cost me just thirty rupees.
The poha was soft and the tarri was really spicy, I would rate it nine out of ten. If you can't handle spice ask them for less tarri.
Next we went to Gandhibagh for samosa with kadhi. Two samosas with kadhi were forty rupees and honestly the kadhi was a bit too sour for my taste.
Then we tried saoji chicken at a small place near Itwari. Saoji food is a speciality of Nagpur made with a very hot black masala. A half plate was one hundred and twenty rupees.
Warning, saoji is extremely spicy. My friend Rohit had to drink two glasses of buttermilk after the first bite.
For something sweet we went to Haldiram's on the way back and got santra barfi, which is the famous orange barfi of Nagpur, because Nagpur is the orange city. Two hundred grams cost one hundred rupees.
Then we had a cold coffee at a stall near Futala lake for fifty rupees. The view of the lake in the evening is beautiful, definitely go there around sunset.
Our last stop was pani puri near Dharampeth. Six puris for twenty rupees and they had both sweet and spicy water options.
So the total spending came to three hundred and sixty rupees, well under our budget of five hundred.
My favourite of the day was definitely the tarri poha at Sitabuldi, and the most overrated for me was the samosa kadhi.
If you are visiting Nagpur in summer, be careful because temperatures go above forty five degrees, so do the food tour in the evening.
Tell me in the comments which city I should do a food tour in next. Thank you for watching.
"""),

"phonecam04d": ("Phone Photography Tips: Shoot Like a Pro With Any Phone", """
Hey friends, you don't need an expensive camera to take great photos. In this video I'll share the phone photography tips I actually use.
Tip number one, clean your lens. It sounds silly but your phone lens is covered in fingerprints and it makes photos look hazy. I just wipe it with my t shirt before every shoot.
Tip two, turn on the grid lines in your camera settings and use the rule of thirds. Place your subject on one of the lines instead of the centre.
Tip three, tap to focus and then drag the exposure slider down a little. Phones tend to overexpose bright skies, so lowering exposure keeps the highlights from blowing out.
Tip four is about light. The best time to shoot is golden hour, about one hour after sunrise or one hour before sunset, when the light is soft and warm.
If you are shooting indoors, stand facing a window. Natural window light is the most flattering light for portraits.
Tip five, avoid digital zoom. Zooming in with two fingers just crops the image and reduces quality. Walk closer instead, or use the telephoto lens if your phone has one.
For portraits I use portrait mode but I reduce the blur strength to around f four, because the maximum blur looks fake around the hair.
Tip six, use burst mode for moving subjects like pets or kids. Hold the shutter button and pick the sharpest photo later.
At night use night mode and keep the phone very still. I rest it on a wall or a railing, or I use a small tripod that cost me three hundred rupees.
For editing I use Snapseed, which is completely free. My usual edit is to raise shadows, lower highlights, add a little structure and then a slight warmth.
I don't use heavy filters, my rule is to keep edits subtle so the photo still looks natural.
Shoot in RAW if your phone supports it, it gives much more flexibility when editing, but the files are bigger.
My current phone is a Pixel 7a, and I have been using it for all the photos on my Instagram for the last year.
That's all the tips. Practice every day for a week and you'll see the difference. Bye.
"""),
}

# (question, video_id, gold phrase that must appear in a retrieved chunk)
QUESTIONS = [
 ("How much did the whole computer cost you?", "pcbuild01aa", "forty nine thousand six hundred"),
 ("which cpu did you choose", "pcbuild01aa", "ryzen 5 5600"),
 ("Is it safe to buy a second hand graphics card? how did you check it", "pcbuild01aa", "furmark"),
 ("Why did you pick that motherboard?", "pcbuild01aa", "two m2 slots"),
 ("Should I use one RAM stick or two?", "pcbuild01aa", "single stick of ram"),
 ("what PSU wattage is in the build", "pcbuild01aa", "550 watt"),
 ("What cabinet did you use?", "pcbuild01aa", "ice112"),
 ("What was the hardest part of putting it together?", "pcbuild01aa", "front panel connectors"),
 ("my memory is showing 2133 mhz, what setting fixes it", "pcbuild01aa", "xmp profile"),
 ("How many FPS do you get in Valorant?", "pcbuild01aa", "two hundred and forty frames"),
 ("Can it run Cyberpunk?", "pcbuild01aa", "sixty five fps"),
 ("How hot does the graphics card get while gaming?", "pcbuild01aa", "seventy two degrees"),
 ("What should I upgrade first later on?", "pcbuild01aa", "another sixteen gigs"),
 ("How long are your study sessions before a break?", "studyhab02b", "fifty minutes of focus"),
 ("Where do you keep your mobile while studying?", "studyhab02b", "another room"),
 ("Which subject do you study first in the morning?", "studyhab02b", "hardest subject"),
 ("What note taking method do you follow?", "studyhab02b", "cornell method"),
 ("Do you just reread your notes?", "studyhab02b", "active recall"),
 ("Do you use flashcards app?", "studyhab02b", "anki"),
 ("Do you listen to songs when studying?", "studyhab02b", "lofi beats"),
 ("How many hours do you sleep during exams?", "studyhab02b", "seven to eight hours"),
 ("what workout do you do", "studyhab02b", "skipping rope"),
 ("Is group study useful?", "studyhab02b", "doubt solving"),
 ("What do you do in the final week before exams?", "studyhab02b", "stop learning new things"),
 ("what was your mistake in 1st year", "studyhab02b", "beautiful colourful notes"),
 ("Where can I get the best poha in Nagpur?", "streetfd03c", "sitabuldi for tarri poha"),
 ("What is tarri?", "streetfd03c", "spicy chana curry"),
 ("How much was the saoji chicken?", "streetfd03c", "one hundred and twenty rupees"),
 ("Is saoji food spicy?", "streetfd03c", "extremely spicy"),
 ("What sweet should I buy from Nagpur?", "streetfd03c", "santra barfi"),
 ("Best place to see the sunset in the city?", "streetfd03c", "futala lake"),
 ("How much money did you spend overall on the food tour?", "streetfd03c", "three hundred and sixty rupees"),
 ("Which dish disappointed you?", "streetfd03c", "most overrated"),
 ("When is the best time of day for street food in summer?", "streetfd03c", "in the evening"),
 ("my photos look blurry and hazy, why?", "phonecam04d", "clean your lens"),
 ("How do I compose a shot better?", "phonecam04d", "rule of thirds"),
 ("The sky in my photos is always too bright", "phonecam04d", "overexpose bright skies"),
 ("When is golden hour?", "phonecam04d", "one hour after sunrise"),
 ("How do I take good pictures inside the house?", "phonecam04d", "facing a window"),
 ("Should I pinch to zoom?", "phonecam04d", "avoid digital zoom"),
 ("What blur setting do you use for portrait mode?", "phonecam04d", "f four"),
 ("How do you photograph my dog running around?", "phonecam04d", "burst mode"),
 ("Which app do you edit pictures with?", "phonecam04d", "snapseed"),
 ("What phone do you own?", "phonecam04d", "pixel 7a"),
 ("tips for clicking photos at night", "phonecam04d", "night mode"),
]

# Should be refused: off-topic, or on a nearby topic the creator never covered.
UNANSWERABLE = [
 "What is the capital of France?",
 "Who won the IPL in 2024?",
 "Write me a poem about the ocean",
 "What is your opinion on the stock market?",
 "How do I cook biryani at home?",
 "Can you explain quantum entanglement?",
 "What's the best laptop for video editing?",
 "Which mechanical keyboard do you use?",
 "Do you recommend Intel i9 for streaming?",
 "What is the best food in Mumbai?",
 "How do you prepare for GATE exam interviews?",
 "Which drone do you use for aerial shots?",
 "How much do you earn from YouTube?",
 "What's the weather tomorrow?",
 "Tell me a joke",
 "How to fix a leaking tap",
 "What is the price of iPhone 16?",
 "Who is the prime minister of India?",
]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", "", s.lower().replace("-", ""))).strip()


def caption_segments(text: str, words_per_seg: int = 8, secs: int = 3):
    """Auto-caption style: lower-case, punctuation stripped, ~8 words each."""
    out, t = [], 0
    for para in [p for p in text.strip().split("\n") if p.strip()]:
        tokens = para.split()
        for i in range(0, len(tokens), words_per_seg):
            chunk = " ".join(tokens[i:i + words_per_seg])
            if not chunk.startswith("[Music]"):
                chunk = re.sub(r"[.,!?]", "", chunk).lower()
            out.append({"t": t, "text": chunk})
            t += secs
    return out


def transcripts():
    from app.ingestion import TranscriptSegment, VideoTranscript
    return [
        VideoTranscript(video_id=vid, title=title, source="captions",
                        segments=[TranscriptSegment(start_seconds=s["t"], text=s["text"]) for s in caption_segments(body)])
        for vid, (title, body) in VIDEOS.items()
    ]

# Viewers who quote exact names / terms (where keyword search should help).
KEYWORD_QUESTIONS = [
 ("Is the Ryzen 5600 stock cooler enough?", "pcbuild01aa", "stock cooler"),
 ("how is the airflow on the Ant Esports ICE-112", "pcbuild01aa", "mesh front"),
 ("B550M VRM good?", "pcbuild01aa", "decent vrm"),
 ("Crucial NVMe load times?", "pcbuild01aa", "basically instant"),
 ("GTA 5 fps on very high", "pcbuild01aa", "one hundred and ten fps"),
 ("Cornell notes layout", "studyhab02b", "cue column"),
 ("Theory of Computation when do you study it", "studyhab02b", "brain is freshest"),
 ("Anki how many minutes per day", "studyhab02b", "twenty minutes every night"),
 ("previous year papers how many years", "studyhab02b", "last five years"),
 ("Haldiram santra barfi price", "streetfd03c", "one hundred rupees"),
 ("Gandhibagh samosa kadhi review", "streetfd03c", "too sour"),
 ("Dharampeth pani puri price", "streetfd03c", "six puris for twenty rupees"),
 ("Rohit buttermilk saoji", "streetfd03c", "two glasses of buttermilk"),
 ("Snapseed editing steps", "phonecam04d", "raise shadows"),
 ("RAW vs JPEG on phone", "phonecam04d", "shoot in raw"),
 ("tripod price for night shots", "phonecam04d", "three hundred rupees"),
 ("portrait mode f4 hair", "phonecam04d", "looks fake around the hair"),
]
UNANSWERABLE += [
 "What is the best RTX 4090 deal?",
 "How do I install Linux on my PC?",
 "Which coaching do you recommend for JEE?",
 "What's your favourite restaurant in Pune?",
 "Which DSLR lens should I buy?",
 "How do I grow my Instagram followers?",
]
