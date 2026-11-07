

---

## PROFESSION: OCCUPATIONAL THERAPY (overrides the physiotherapy guidance above)

This scenario is for an **occupational therapy (OT) student** taking an initial interview with a **client**, not a physiotherapy student. Everything above still applies except where this section says otherwise. Base the case on the OT TWC case simulations (tennis elbow, carpal tunnel syndrome, De Quervain's disease and similar upper-limb conditions), and centre it on what the condition stops the person doing.

### `scenario_prompt` for OT
Use these headings instead of the physiotherapy ones:
* `Occupational Therapy Case:` [Brief Title, e.g. 'Lateral Epicondylalgia in an Office Administrator']
* `Client Profile:` full Name, Age, Gender, Dominant hand, Occupation, Living situation, Presenting Complaint.
* `History of Present Illness:` onset, duration, progression, what they were doing when it began, nature and location of pain, spread, aggravating and easing factors, 24-hour pattern, associated symptoms (numbness, pins and needles, weakness, swelling).
* `Pain:` a short table in words: pain at rest, with activity, at night (0 to 10).
* `Medical History:` past medical history, medications, previous elbow/forearm/wrist/neck/shoulder problems.
* `Relevant Investigations:` X-ray, ultrasound, nerve conduction or other results, and what the client understood of them.
* `Previous Treatment:` treatments, medication, splints or braces, and how well each worked.
* `Occupational History:` job tasks, repetitive hand or wrist use, gripping, lifting, tool use, rest breaks, workstation set-up.
* `Social History and Roles:` living situation, family roles (e.g. carer, parent), support, hobbies, sports and leisure.
* `Activities of Daily Living (ADL):` the self-care tasks that are hard and how (e.g. squeezing toothpaste, fastening buttons, holding cutlery).
* `Instrumental ADL (IADL):` household and community tasks that are hard and how (e.g. wringing cloths, opening jars, carrying shopping, cooking).
* `Activities Stopped or Changed:` what the client has stopped, avoided or now does differently.
* `Simulated Physical Examination Findings:` observation, palpation, active range of the elbow, wrist, thumb and fingers, grip and pinch strength (kgf, both sides), and the special tests for the condition (e.g. Cozen's or Mill's test for tennis elbow, Phalen's and Tinel's for carpal tunnel, Finkelstein for De Quervain's).
* `Outcome Measures:` plausible results for the Modified Barthel Index, the Lawton IADL Scale and the DASH.
* `Client’s goals:` the activities they most want to return to or do more easily.
* `Simulation Objectives for Student:` key learning points, covering occupational performance, environment and goals.

In the Simulation Instructions, the bot plays the **client**. It describes difficulties as everyday tasks (e.g. "I can't wring out the dishcloth any more", "I drop my chopsticks"), not as joint movements. In the Sample Conversation the student says: 'I'm [Student Name], a student occupational therapist.'

### `movements` for OT
The simulator cannot animate the elbow, wrist, thumb or fingers. Describe those in the `Simulated Physical Examination Findings` and set every key in `movements` to `"Full"`, unless the neck or shoulder is also genuinely affected.

### `questions_for_feedback` for OT
This replaces the physiotherapy list. It **MUST** contain exactly **30** questions: these 25 core questions, word for word and in this order, then exactly 5 scenario-specific questions, each starting with its [criterion] tag as described above.
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

The Final Check above therefore expects **30** items (25 core + 5 specific) for OT, not 29.
