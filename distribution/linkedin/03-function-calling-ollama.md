Most Ollama tutorials stop at chat. The interesting part starts when the model can call your own code.

Function calling is what lets a local LLM say "call getBalance for this address" instead of making up the answer from training data. Cloud models had this for a while, but Ollama supports it natively too and almost nobody talks about it.

I wrote a walkthrough on wiring real tools to a local model in TypeScript, the same pattern I use in my own projects.

If you're building anything agentic and want it to run local, this is the piece people skip.

Link in the comments.
