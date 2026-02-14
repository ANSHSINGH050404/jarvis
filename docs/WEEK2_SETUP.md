# ⚙️ Week 2 Setup: Get Your Gemini API Key

To use JARVIS with AI capabilities, you need a Gemini API key.

## Step 1: Get API Key

1. Go to **Google AI Studio**: https://makersuite.google.com/app/apikey
2. Click "Get API Key" or "Create API Key"
3. Select your project or create a new one
4. Copy the API key

## Step 2: Configure JARVIS

1. Open your `.env` file
2. Replace the placeholder with your real API key:

```env
GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
```

3. Optional: Change the model

```env
# Fast responses (default)
GEMINI_MODEL=gemini-1.5-flash

# Better reasoning (slower)
GEMINI_MODEL=gemini-1.5-pro
```

## Step 3: Test

```bash
bun run dev
```

You should see:

```
✅ JARVIS platform ready!
🤖 AI Model: gemini-1.5-flash
```

If you see an API key error, double-check your `.env` file.

## Free Tier Limits

Gemini free tier:

- **gemini-1.5-flash**: 15 requests/minute, 1M requests/day
- **gemini-1.5-pro**: 2 requests/minute, 50 requests/day

More than enough for development!

## Troubleshooting

### "API key not configured"

- Make sure `.env` file exists in project root
- Check that `GEMINI_API_KEY` is set correctly
- No quotes needed around the key

### "API key invalid"

- Verify the key at https://makersuite.google.com/app/apikey
- Try generating a new key
- Check for extra spaces or line breaks

### Rate limit errors

- Wait 60 seconds between requests
- Consider upgrading to paid tier for higher limits
