# The Infinite Cheesecake Factory

An inexhaustible upscale-casual restaurant hallucination. Keep scrolling, receive five new dishes, and click anything that sounds inadvisable to have the image kitchen plate it.

Despite the name, this is not an infinite list of cheesecakes. It is an infinite Cheesecake Factory-*sized menu*: appetizers, salads, steaks, pasta, cocktails, desserts, and culinary concepts that should not survive contact with reality.

## How it works

- A checked-in pool of 1,000 Wikipedia subjects is split across ten topic families.
- Each five-dish batch samples ten subjects and pairs unlike families together.
- Gemini 3.1 Flash-Lite fuses each pair into one surreal menu item using strict structured output.
- Selecting a dish sends its complete visual description to Runware's TwinFlow Z-Image-Turbo model.
- Infinite scroll requests five more dishes as you approach the end. Each browser gets its own persistent timeline.
- There are deliberately no generated-menu or image fallbacks: if a kitchen is offline, the error is shown.

## Selected evidence

| The Rite of Birth-Song | Melancholy Emulsion |
| --- | --- |
| ![The Rite of Birth-Song: pastry figures performing a ritual around an edible goat](docs/examples/rite-of-birth-song.jpg) | ![Melancholy Emulsion: a weeping pastry face floating in golden oil](docs/examples/melancholy-emulsion.jpg) |

| Late Capitalism Mimosas | Grunewald's Suffering Flatbread |
| --- | --- |
| ![Late Capitalism Mimosas: a mimosa assembled like a financial ladder](docs/examples/late-capitalism-mimosas.jpg) | ![Grunewald's Suffering Flatbread: a Renaissance religious scene baked into a pizza](docs/examples/grunewald-suffering-flatbread.jpg) |

Generated outputs are unpredictable. That is the restaurant's principal amenity.

## Run locally

Requires Node.js 22.13 or newer and API keys for [Google's Gemini API](https://ai.google.dev/gemini-api/docs/api-key) and [Runware](https://runware.ai/).

```bash
npm install
cp .env.example .env.local
```

Add your keys to `.env.local`:

```dotenv
GEMINI_API_KEY=your_gemini_key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-3.1-flash-lite

RUNWARE_API_KEY=your_runware_key
```

Then start the restaurant:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```bash
npm run build
node scripts/audit-wikipedia-pool.mjs
```

The Wikipedia pool is already baked into `data/wikipedia-subjects.json`; normal app usage does not fetch Wikipedia. Rebuilding the corpus is an explicit maintenance operation using the scripts in `scripts/`.

## Stack

- React 19, Vinext, and Vite
- Gemini 3.1 Flash-Lite for menu generation
- Runware `runware:twinflow-z-image-turbo@0` for dish images
- Wikipedia/Wikidata for the checked-in inspiration corpus

## Notes

- API keys stay server-side and `.env.local` is ignored by Git.
- Generated images may occasionally contain invented text despite the negative prompt.
- Archive state and the per-browser menu timeline live only in local storage.
