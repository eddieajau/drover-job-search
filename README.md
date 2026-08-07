# Drover Job Search

Lightweight job search, tracking and application tool.
Built by a job seeker, for job seekers.

![Jobs Dashboard](/docs/dashboard.png)

Job hunting is hard and job listing sites are designed for the 2010's, not for modern job seekers in 2026.
There are a few skills-based approaches out there but they assume you can afford a Claude MAX plan while you are between roles.
Or there is a system to do just the resume and you have to fill in all the details.
What if there was a system that herded all those sheep in one go?
**Drover** is a survival project that attempts to put a barbed-wire fence around that flock.

Drover is designed with local-first/local-only in mind.

## Goals

- ✅ A better job dashboard
- ✅ Flag jobs for deeper analysis
- ✅ Static regex filtering for deal-breakers (looking at you Java)
- Add jobs manually
- Add skills, experiences, education and other facts about you
- Reliable job scoring/matching
- Generate tailored cover letters
- Generate tailored resumes

Currently tuning against a local `qwen3.6-35b-64k` model

## Quick Start

```bash
make install
npm run portal
```

Opens at http://localhost:4000
