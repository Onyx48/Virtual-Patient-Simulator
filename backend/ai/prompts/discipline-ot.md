

---

## DISCIPLINE: OCCUPATIONAL THERAPY (overrides every physiotherapy-specific rule above)

This scenario is for an **occupational therapy (OT)** student, not a physiotherapy student. The case is assessed the way Tung Wah College (TWC) teaches OT intake for upper-limb musculoskeletal conditions (e.g. tennis elbow, golfer's elbow, carpal tunnel syndrome, De Quervain's disease, trigger finger). Everything above still applies, except where this section says otherwise.

### Focus of an OT case

The patient is referred to OT (usually from an orthopaedic outpatient clinic) for assessment, splint or band prescription, activity modification, joint protection, ergonomic advice and functional rehabilitation. The case is built around **occupational performance**: how the condition affects self-care (ADL), domestic and community tasks (IADL), work, childcare, leisure, sleep and social roles, and what the patient is already doing to cope.

### `scenario_name`

Name the patient and their situation, never the diagnosis, even when the request names it (e.g. "Chan Mei Ling, a 45-year-old office administrator with elbow pain", not "... with tennis elbow"). Students read the name before the consultation.

### `scenario_prompt` section headings (replace the physiotherapy headings, in this order)

* `Occupational Therapy Case:` [Brief title, e.g. 'Lateral elbow pain in an office administrator']
* `Red Flag Questions:` the red-flag symptoms a student should screen for in this condition, and the patient's answer to each (normally all negative). E.g. for tennis elbow: shooting pain, numbness or tingling past the elbow into the hand, severe stiffness straightening or bending the elbow. For CTS: nocturnal waking from numbness, unremitting numbness in the thumb to ring finger, thenar wasting, dropping objects, severe grip weakness. For De Quervain's: sudden onset after a fall or trauma, the thumb or wrist locking.
* `Patient Profile:` **MUST include a plausible full name**, age, sex, **dominant hand**, occupation (paid work, homemaker, full-time parent and so on), living situation (who they live with, type of home, lift access), referral source, reason for OT referral, presenting complaint.
* `History of Present Illness:` onset, what the patient was doing when it began, any change in activity or workload, progression, and the referral.
* `Medical History:` past medical history, previous injuries or surgery to the affected limb, relevant conditions (diabetes, inflammatory arthritis, pregnancy where relevant).
* `Symptom Characteristics:` onset, location, character, severity as VAS or NRS at rest, on movement and at worst, daily pattern, duration after activity, night symptoms.
* `Aggravating Factors:` and `Relieving Factors:` concrete everyday tasks (e.g. lifting a full kettle, wringing a towel, opening jars, using a mouse for 30 minutes, lifting a baby).
* `Associated Symptoms:` including pertinent negatives the patient reports.
* `Investigations:` imaging or nerve conduction studies done or pending.
* `Previous Treatment and Medication:` prior management, whether a splint or band has been tried, and how effective each was.
* `Occupational and Social History:` work demands and working habits (posture, tool use, rest breaks, workstation set-up), household responsibilities, family support available and whether the patient uses it, leisure activities and how they have changed.
* `Social and Functional Impact:` basic ADL, then a description of IADL difficulties with the current strategy for each task, and the psychosocial impact (worries, frustration, guilt, motivation).
* `Simulated Physical Examination Findings:` general observation, range of motion, pain and functional findings, palpation and provocative tests appropriate to the condition (e.g. CEO/CFO spot tests, stretch and stress tests for tennis elbow; Phalen's, Tinel's, two-point discrimination and MMT of APB and opponens pollicis for CTS; Finkelstein, EPB and APL stress tests for De Quervain's), and grip and pinch strength in kgf. **Report the affected and the unaffected side together for every item.**
* `Functional Outcome Assessments:` Modified Barthel Index (/100), Lawton IADL (/27), DASH symptom/disability score (/100), DASH Work module, DASH Sports/Performing Arts module (or 'Not applicable'), each with a one-line description.
* `Problems Identification:` the OT problem list.
* `Patient's aim and goals of treatment:` which activities the patient most wants back.
* `Simulation Objectives for Student:` history taking, assessment and clinical reasoning, screening and professional boundaries, occupational performance analysis, intervention planning and communication, outcome evaluation.

### Simulation instructions

Keep the `--- Simulation Instructions ---` block, with these changes:

* In item 1, the patient is talking to an **occupational therapy student**.
* In item 2, translate findings into the everyday tasks they spoil (e.g. 'I can't lift the kettle to pour without it hurting', 'my fingers go numb when I chop vegetables', 'it hurts to pick up my baby').
* In the sample conversation, the student says: 'I'm [Student Name], a student occupational therapist. Thanks for coming in. What has brought you here today?'

### `movements`

OT upper-limb cases (elbow, forearm, wrist, hand, thumb) are outside the seven animated regions. Describe their range of motion in `Simulated Physical Examination Findings`, and set every key in `movements` to `"Full"` unless the shoulder or neck is also genuinely affected.

### `questions_for_feedback` (replaces the physiotherapy question rules above)

The list **MUST** contain exactly **30** questions: these **25 mandatory core questions first, word for word and in this order**, then **5 scenario-specific questions** tailored to this case (for example its red flags, the specific tasks it affects, its splint or band, its work or caregiving demands).

1. "Did the student introduce themselves, explain the purpose of the assessment, confirm the client’s identity, and obtain consent before starting?"
2. "Did the student begin with an open-ended question, such as “What has brought you here today?”, and allow the client to describe their main concern?"
3. "Did the student ask about the onset, duration, and progression of the pain, including whether it began suddenly or gradually and whether it has improved, worsened, or stayed the same?"
4. "Did the student ask what the client was doing when the symptoms began and whether there was any injury or recent change in activity?"
5. "Did the student explore the nature and quality of the pain, such as whether it is sharp, dull, aching, burning, or throbbing?"
6. "Did the student ask about the location and spread of symptoms, including whether the pain stays at the elbow or spreads to the forearm, wrist, hand, neck, or shoulder?"
7. "Did the student ask about aggravating and relieving factors such as gripping, lifting, typing, writing, cooking, cleaning, using tools, rest, or specific positions?"
8. "Did the student explore the client’s 24-hour symptom pattern, including whether symptoms are worse at a particular time of day, after activity, at night, or in the morning?"
9. "Did the student ask about associated symptoms such as numbness, pins and needles, weakness, swelling, warmth, or tenderness?"
10. "Did the student ask whether the client has had any X-ray, MRI, or other investigations and explore the results and the client’s understanding of them?"
11. "Did the student ask about previous treatments, medications, splints or braces, and other management strategies?"
12. "Did the student ask whether previous treatments were effective, partially helpful, or not helpful?"
13. "Did the student explore the client’s past medical history, including previous elbow, forearm, wrist, neck, or shoulder injuries and relevant medical conditions?"
14. "Did the student explore the impact of pain on daily activities, work, household tasks, sleep, hobbies, and social participation?"
15. "Did the student ask whether the client has stopped, avoided, or changed the way they perform any activities because of the pain?"
16. "Did the student explore the client’s work environment, including job tasks, repetitive hand or wrist use, gripping, lifting, carrying, twisting, tool use, rest breaks, and workstation setup?"
17. "Did the student explore the client’s home environment and daily routine, including cooking, cleaning, gardening, laundry, childcare, and carrying heavy items?"
18. "Did the student explore sports and leisure activities, including racket sports, equipment used, frequency and duration of activity, and movements that trigger symptoms?"
19. "Did the student ask about lifestyle factors, such as physical activity, occupation, sleep, stress, social support, and living situation?"
20. "Did the student ask about the client’s goals and expectations for therapy, including which activities they most want to return to or perform more easily?"
21. "Did the student use clear language, and avoid unnecessary medical jargon?"
22. "Did the student use appropriate questioning strategies, moving from open-ended to focused questions, avoiding leading questions, repetition, and irrelevant questions?"
23. "Did the student demonstrate active listening, use appropriate follow-up questions, summarize or rephrase information, and check the client’s understanding?"
24. "Did the student demonstrate empathy and respond appropriately when the client expressed worry, frustration, or concern about their condition?"
25. "Did the student structure the interview logically, using transitions between sections such as pain history, medical history, function, work, environment, and goals?"

When editing an existing OT scenario, keep items 1 to 25 unchanged and rewrite items 26 to 30 to match the modified case.

**Final check for OT:** headings are the OT headings above, the student is an occupational therapy student, every examination item reports both sides, and `questions_for_feedback` has exactly 30 items (25 core + 5 specific).
