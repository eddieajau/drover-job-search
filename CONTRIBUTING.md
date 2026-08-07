# Contributing to Drover

Drover is a tool to help with job searching. This file is the contract for changing it.

## On AI

Use it. Seriously — AI assistance is **expected**, not merely tolerated. Generate
code with it, draft docs with it, let it write your tests. There's no disclosure
ritual and no badge of shame. This project was largely built that way.

The deal is simple, and it is the whole point:

> **You are the author. The model is a tool. You stand behind what you ship — you
> understand what it does, and you've verified it works.**

A pull request is a claim that _you_ vouch for the change, regardless of who or
what typed it. "The AI wrote it" explains nothing and excuses nothing. You don't
have to grasp every line — high-level understanding plus verification is the bar,
not a line-by-line audit — but you do need to know what the change does, why it's
there, and that it genuinely works.

Slop is the opposite: noise, and not the good kind. Plausible-looking code that
was never run, invented APIs, tests that assert nothing, docs that describe
features that don't exist. That's not an AI problem; it's an _unchecked-work_
problem, and it gets the same answer either way: bounced.

## What "check your work" actually means

Before you open a PR, all of these are true:

- **It's tested, and the tests pass.** `npm run verify` is green, and your
  change adds or updates tests that exercise it. A test that can't fail
  isn't a test.
- **You looked over the diff and understand the change.** Not every line — but
  what it does, why it's there, and how it fits. Nothing in it is a black box to
  you.
- **It matches the house style.** See [`CLAUDE.md`](CLAUDE.md) for the working
  conventions — most of all: **one axis per change.** A change touches a single
  concern, not three. If your summary needs "and" between top-level changes,
  split the PR.

## Building and running

TODO (probably see README)

## Licence

Drover is MIT (see [`LICENSE`](LICENSE)). By contributing, you agree your
contribution is licensed under the same terms, and you confirm it is your own
work (per the clean-room rule above) and free to release under MIT.

## Pull request checklist

- [ ] One axis — a single concern, not several bundled together.
- [ ] `verify` all clean.
- [ ] New/changed behaviour is covered by tests that can actually fail.
- [ ] I understand what this change does and why, and I stand behind it —
      whoever typed it.
