# 🧪 Week 2 Testing Guide

## What to Test

Week 2 adds real AI capabilities with Gemini LLM. You should test:

- ✅ Conversational responses (not just echo)
- ✅ Streaming tokens in real-time
- ✅ Context/memory within conversation
- ✅ Different question types

## Prerequisites

**IMPORTANT**: You need a Gemini API key configured in `.env`:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

Get one free at: https://makersuite.google.com/app/apikey

## Test 1: Basic Conversation

```bash
# Terminal 1: Start server
bun run dev

# Terminal 2: Test client
bun run dev:test-client
```

You should see:

1. Connection established
2. **Streaming tokens** appearing word-by-word (not echo!)
3. Real AI responses about TypeScript and event-driven architecture

## Test 2: Conversation Memory

The agent remembers context within a session. Try this manually:

```bash
# Use a WebSocket client or write a custom test
```

Send these messages in sequence:

1. "My name is Alex"
2. "What's my name?"  
   → Should respond with "Alex"

## Test 3: HTTP Endpoint

```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Explain TypeScript in one sentence"}'
```

Check server logs for the AI response.

## Test 4: Different Question Types

Try asking:

- Technical questions: "What is dependency injection?"
- Creative requests: "Write a haiku about coding"
- Reasoning: "Why should I use TypeScript over JavaScript?"

## Expected Behavior

### ✅ Correct

- Intelligent, contextual responses
- Streaming tokens in real-time
- Remembers conversation context
- Handles errors gracefully

### ❌ Issues

**"API key not configured"**
→ Set `GEMINI_API_KEY` in `.env`

**Rate limit errors**
→ Free tier: 15 req/min. Wait 60s between tests

**No streaming visible**
→ Check WebSocket client is processing stream chunks

**Responses are slow**
→ Normal for first request. Try `gemini-1.5-flash` for speed

## Performance Expectations

| Model            | Speed | Quality   |
| ---------------- | ----- | --------- |
| gemini-1.5-flash | ~1-2s | Good      |
| gemini-1.5-pro   | ~3-5s | Excellent |

## Debugging

Enable debug logging in `.env`:

```env
LOG_LEVEL=debug
```

Watch for:

```
[AgentRuntime] Processing message
[GeminiProvider] Generating streaming response
[Gateway] Message sent
```

## Next: Week 3

Once this works, we'll add:

- Tool calling (read files, make HTTP requests)
- Function execution
- Multi-step reasoning
