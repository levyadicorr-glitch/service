"""Multi-agent orchestrator: runs Planner, Coder, and Reviewer concurrently against
a single prompt, then feeds their outputs to a Synthesizer agent for a final answer.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python orchestrator.py "Build a rate limiter for a REST API in Go"

Requires: pip install anthropic
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass

from anthropic import AsyncAnthropic, APIError

MODEL = "claude-sonnet-5"
MAX_TOKENS = 2048


@dataclass
class AgentResult:
    role: str
    content: str
    error: str | None = None


AGENT_SYSTEM_PROMPTS: dict[str, str] = {
    "Planner": (
        "You are the Planner agent. Break the user's request into a clear, "
        "numbered implementation plan: key steps, components, and any "
        "important edge cases or decisions. Do not write code."
    ),
    "Coder": (
        "You are the Coder agent. Write a concrete implementation that "
        "satisfies the user's request. Prefer complete, runnable code over "
        "prose. Keep explanation minimal."
    ),
    "Reviewer": (
        "You are the Reviewer agent. Independently analyze the user's "
        "request and flag risks, likely bugs, missing requirements, and "
        "trade-offs a naive implementation might miss. Do not write code."
    ),
}

SYNTHESIZER_SYSTEM_PROMPT = (
    "You are the Synthesizer agent. You are given a user's original request "
    "plus independent outputs from a Planner, a Coder, and a Reviewer who "
    "each worked on it without seeing each other's output. Reconcile their "
    "input into one final, coherent answer: incorporate the Reviewer's valid "
    "concerns into the Coder's implementation, and structure the result "
    "using the Planner's breakdown where it helps clarity. Produce the best "
    "single answer to the original request, not a summary of the three inputs."
)


async def run_agent(client: AsyncAnthropic, role: str, prompt: str) -> AgentResult:
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=AGENT_SYSTEM_PROMPTS[role],
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        return AgentResult(role=role, content=text)
    except APIError as exc:
        return AgentResult(role=role, content="", error=str(exc))


async def run_synthesizer(client: AsyncAnthropic, prompt: str, results: list[AgentResult]) -> AgentResult:
    sections = []
    for result in results:
        if result.error:
            sections.append(f"### {result.role} (FAILED: {result.error})\n(no output)")
        else:
            sections.append(f"### {result.role}\n{result.content}")

    synthesizer_input = (
        f"Original request:\n{prompt}\n\n"
        + "\n\n".join(sections)
        + "\n\nProduce the final synthesized answer now."
    )

    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS * 2,
            system=SYNTHESIZER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": synthesizer_input}],
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        return AgentResult(role="Synthesizer", content=text)
    except APIError as exc:
        return AgentResult(role="Synthesizer", content="", error=str(exc))


async def orchestrate(prompt: str) -> tuple[list[AgentResult], AgentResult]:
    client = AsyncAnthropic()

    agent_results = await asyncio.gather(
        *(run_agent(client, role, prompt) for role in AGENT_SYSTEM_PROMPTS)
    )

    final = await run_synthesizer(client, prompt, list(agent_results))
    return list(agent_results), final


def print_result(result: AgentResult) -> None:
    print(f"\n{'=' * 20} {result.role} {'=' * 20}")
    if result.error:
        print(f"[error] {result.error}", file=sys.stderr)
    else:
        print(result.content)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-agent orchestrator (Planner/Coder/Reviewer -> Synthesizer)")
    parser.add_argument("prompt", nargs="?", help="Task for the agents to work on")
    args = parser.parse_args()

    prompt = args.prompt or input("Prompt: ").strip()
    if not prompt:
        parser.error("a prompt is required")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        parser.error("ANTHROPIC_API_KEY environment variable is not set")

    agent_results, final = await orchestrate(prompt)

    for result in agent_results:
        print_result(result)
    print_result(final)


if __name__ == "__main__":
    asyncio.run(main())
