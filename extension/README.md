# YouTwin browser sidebar (Chrome / Edge, Manifest V3)

The M5 "browser sidebar" delivery channel. While a viewer watches a
YouTube video, the sidebar:

- finds the creator's YouTwin link in the video description (or accepts a pasted link),
- chats with that creator's twin through the public `/chat` API,
- sends the **current video and playhead** with every question, so answers are tied to that moment,
- turns every citation into a button that seeks the YouTube player to the cited second
  (or opens the cited video at that time).

It only calls the public viewer endpoints (`/twins/by-handle`, `/twins/by-id`, `/chat`),
needs no sign-in, and renders all network text as plain text.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension` folder.
3. Pin YouTwin, open any YouTube video and click the icon. The side panel opens.
4. First run: click ⚙ and enter
   - **Web app URL**: your Vercel frontend, e.g. `https://<your-app>.vercel.app`
   - **API URL**: your api-service, e.g. `https://<your-api>.onrender.com`
5. Reload YouTube tabs that were already open before installing.

The api-service allows `chrome-extension://` origins on the public viewer routes only
(see `api-service/src/index.ts`), so no server change is needed per install.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest: side panel, storage, YouTube content script |
| `background.js` | Opens the side panel when the toolbar icon is clicked |
| `content.js` | On youtube.com: reports video id, playhead, title, twin link; seeks on citation click |
| `sidepanel.*` | The chat UI |
