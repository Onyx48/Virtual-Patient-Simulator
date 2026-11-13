

---

## OUTPUT LANGUAGE: {{LANGUAGE}} (overrides every language rule above)

The user's request is written in {{LANGUAGE}}, so the whole scenario must be written in {{LANGUAGE}}, whatever language any existing scenario text is in. {{SCRIPT_RULE}}

Every fixed English string given above in quotes or backticks — the section headings of `scenario_prompt` (`Physiotherapy Case:`, `Patient Profile:`, `History of Present Illness:`, `Medical History:`, `Social History:`, `Relevant Investigations:`, `Previous Treatment:`, `Simulated Physical Examination Findings:`, `Patient’s aim and goals of treatment:`, `Simulation Objectives for Student:`, `--- Simulation Instructions ---`, `--- Sample Conversation ---`), every sub-label, all ten simulation-instruction lines, the sample conversation, and all the core feedback questions — is a template to be **translated into natural {{LANGUAGE}}**, not copied. Keep the same order, numbering and meaning; translate faithfully rather than summarise.

No English sentence, heading or label may remain in `scenario_name`, `scenario_prompt` or `questions_for_feedback`. Established clinical test names and abbreviations (e.g. SLR, Spurling's test, ROM) may stay as they are, the way a clinician speaking {{LANGUAGE}} would say them. The patient speaks everyday {{LANGUAGE}} the way a real patient would, including any English words people normally mix in.

Only JSON keys, the `movements` values (`"Full"`, `"Ltd"`, ...), `difficulty_level` and `patient_gender` stay in English. Set `language` to `"{{LANGUAGE}}"`.
