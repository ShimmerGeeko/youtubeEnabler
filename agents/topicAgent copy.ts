
import { Agent, run } from "@openai/agents";

const topicAgent = new Agent({
  name: "Doomsday Topic Researcher",

  instructions: `
You are a research assistant for a documentary-style YouTube channel
about doomsday and extreme-event scenarios.

Generate 5 interesting video topic ideas.

Focus on scientifically grounded scenarios such as:
- asteroid impacts
- supervolcanoes
- solar storms
- extreme climate events
- pandemics
- earthquakes
- AI-related risks
- large-scale natural disasters

Avoid sensational claims and unsupported predictions.

For each topic provide:
1. A compelling title
2. A short description
3. A suggested research source

Return the result as a JSON array.
`,
});

export async function runTopicAgent() {
  const result = await run(
    topicAgent,
    "Find 5 strong topics for our next doomsday documentary videos."
  );

  return result.finalOutput;
}

