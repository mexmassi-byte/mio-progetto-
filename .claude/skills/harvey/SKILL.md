---
name: harvey
description: "B2B sales playbook from Harvey (github.com/ethanplusai/harvey): cold email copywriting, prospecting, lead qualification, signal-based outreach, account navigation, objection handling, offers and closing, LinkedIn outreach, selling to startup founders. Use when writing or reviewing cold emails and follow-up sequences, answering prospect replies or objections, qualifying leads or building an ICP, planning prospecting, or drafting LinkedIn outreach. Trigger: /harvey"
---

# /harvey — sales playbook

Foundational sales knowledge taken from the open-source Harvey autonomous sales agent
(MIT, Ethan Rogers, upstream commit `6b6a23a`). Harvey's agents load these playbooks
before every decision; this skill gives Claude the same knowledge on demand.

This skill is the **knowledge only**. It does not prospect, scrape, or send anything.
Drafts are for a human to review and send.

## How to use

1. Work out which task the user has, then read **only** the matching reference files
   from `references/` (paths relative to this SKILL.md). Don't load all of them.
2. Follow the files' rules. Where a file has a compliance, ethics or "hard rules"
   section, it overrides every style rule in the other files.
3. If the user hasn't told you about their product, offer, audience or sender identity,
   ask for it before writing copy — never invent product facts, prices, customers,
   case studies or a prior relationship with the prospect.

## Which files to read

| Task | Read |
|------|------|
| Write a cold email or a 2–3 email sequence | `email_frameworks.md`, `signal_playbook.md`, `offer_strategy.md` |
| Review / fix an existing cold email | `email_frameworks.md` |
| Answer a prospect reply or objection | `objection_handling.md`, `sales_methodology.md`, `offer_strategy.md` |
| Move a conversation toward a meeting, pricing questions | `offer_strategy.md`, `sales_methodology.md` |
| Qualify leads, score against an ICP, BANT/MEDDIC | `lead_qualification.md` |
| Plan prospecting, find companies and contacts | `prospecting_tactics.md`, `signal_playbook.md` |
| Several contacts at one company, who to email first | `account_navigation.md` |
| Use a buying signal (hiring, funding, tech stack) as the hook | `signal_playbook.md` |
| Prospect is a YC / accelerator / recently funded startup | `selling_to_startups.md` (plus the files for the task) |
| LinkedIn connection requests and messages | `linkedin_outreach.md` |

## Non-negotiables (summary of the playbooks' hard rules)

- Truthful subject lines and identity: no fake "re:"/"fwd:", no pretending to be a
  customer or mutual contact, no invented familiarity.
- Every cold campaign needs a working opt-out and the sender's postal address; any
  "stop / remove me / not interested" is a permanent unsubscribe.
- Plain text, short, at most one link (none in email 1), no spam-trigger phrasing.
- EU/UK prospects: only with a real legitimate-interest fit to the person's role.
- Never fabricate signals, metrics, urgency or inside knowledge. If there's no real
  signal, follow the "no real signal" guidance in `signal_playbook.md`.
- Respect LinkedIn's limits and the risk notes in `linkedin_outreach.md`.

## Output

- Emails: subject line + plain-text body, ready to paste; for sequences, label each
  step with its send delay.
- Reviews: list each problem with the rule it breaks, then the rewritten email.
- Reply handling: name the objection category / prospect intent, then the draft reply.
- Write in the language the user writes in (or the prospect's language, if given).
