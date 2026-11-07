# Educator / Lecturer / Clinical Supervisor Mindsets (PT/OT, Singapore, HK, Japan)

Scope note: about 13 tool calls. The evidence is mostly medical-education literature plus a few physio-specific and regional items. I found no direct qualitative study of PT/OT educators' views on AI virtual patients, and nothing specific to Tung Wah College, NUH or Shinshu. I could not fetch Reddit, so there are no forum quotes. Treat regional claims as inferred unless cited.

## 1. How educators talk (assessment language, rubrics, tone)

### Takeaway
Educators frame the value of AI patients in terms of "clinical reasoning", "clinical questioning", history-taking and communication checklists. Validity talk centres on agreement with faculty ("ICC", "Cohen's kappa", "Bland–Altman") and "human oversight".

### Cited Findings
- SIT (Singapore) describes its funded AI project as "Training Physiotherapy Students in Clinical Questioning and Reasoning Using AI". Features: open-ended questioning to diagnose a patient, an avatar showing facial emotion, multiple attempts, and end-of-session checklists covering both physiotherapy content and communication. — [SIT ALIGN/SALT project](https://singaporetech.edu.sg/sit-teaching-and-learning-academy/collaborations/t-and-l-showcase/align-salt-projects/training-physiotherapy-students-in-clinical-questioning-and-reasoning-using-ai) (page text could not be fetched; details come from the search summary)
- A 2026 MOH Singapore speech: SIT uses "ClassAId, Virtual Patient System and the Spinal Mobilisation Objective Feedback Tool to strengthen students' clinical reasoning". This is the official vocabulary. — [MOH speech, SIPC 2026](https://www.moh.gov.sg/newsroom/speech-by-mdm-rahayu-mahzam--minister-of-state--ministry-of-digital-development-and-information---ministry-of-heatlh-at-the-singapore-international-physiotherapy-congress-2026--11-july-2026--9am/)
- SIT researchers published IEEE papers (2023) on a physiotherapy virtual-patient chatbot and its user experience. — [IEEE IEEM 2023](https://api.crossref.org/works/10.1109%2FIEEM58616.2023.10407018); [IEEE TALE 2023](https://api.crossref.org/works/10.1109%2FTALE56641.2023.10398237)
- Faculty judge feedback quality with named instruments (QuAL, EFeCT scores). In one study, faculty rated LLM history-taking feedback higher than expert feedback. — [AAN 2026 abstract](https://index.mirasmart.com/AAN2026/PDFfiles/AAN2026-003711.html)

### Inferences
- The product should use the terms "clinical reasoning", "history taking", "communication checklist" and "objective feedback". Validity claims should be expressed as agreement with faculty.

### Gaps
- I found no verbatim educator quotes about tone with students, and no biopsychosocial rubric quotes from the target institutions.

## 2. Daily reality: workload, OSCEs with SP actors, placements

### Takeaway
SP-based OSCEs are expensive, logistically heavy and noisy across raters. Placements are scarce and supervisors are stressed. In Japan the SP pool itself is shrinking.

### Cited Findings
- Staff variability affects OSCE scores as much as student variability, and low inter-rater reliability "is resistant to standard improvements, e.g., in rater training". UK cost estimate: about £335 per student for a 15-station OSCE (2012 figure). — [BMC Med Educ 2024](https://bmcmededuc.biomedcentral.com/counter/pdf/10.1186/s12909-024-05803-6.pdf)
- Statistically significant inter-examiner variability in an orthopaedics OSCE; the authors suggest pairing strict and lenient examiners. — [KU orthopaedics study](https://ir-library.ku.ac.ke/items/9f8a1062-51f4-4ae5-b41a-751aa9ab1943/full)
- The work starts before the exam: scenario creation, SP onboarding, training, scheduling, logistics and faculty coordination. — [Elevate Health / SSH webinar](https://elevatehealth.net/resources/webinars/ssh-virtual-learning-lab-sps-osces/)
- Japan PT education: SP use has been "limited by the requirement of training standardized simulated patients and costs". The paper calls for PT schools to cooperate. — [J-STAGE JASEHP 2020](https://www.jstage.jst.go.jp/article/jasehp/8/0/8_2020-08-11/_article/-char/en)
- Nagasaki University (Kyodo report): regional universities struggle to secure trained SPs amid population decline. An AI virtual-patient program was planned from March 2026. — [dig.watch](https://dig.watch/updates/nagasaki-university-launches-ai-program-for-medical-student-training)
- Japan: medical-care security policy changes have made clinical training hard even in teaching hospitals. — [KAKEN grant](https://kaken.nii.ac.jp/grant/KAKENHI-PROJECT-16K08877)
- Placement scarcity is attributed to staff shortages, patient acuity, reorganisation and funding. Supervisor stress and feeling unprepared to evaluate shape willingness to supervise. — [PMC5125478](https://pmc.ncbi.nlm.nih.gov/articles/PMC5125478); [BMC Med Educ 2020](https://bmcmededuc.biomedcentral.com/articles/10.1186/s12909-020-02360-6/tables/3)
- SIT PT requires about 30 weeks (around 1,000 hours) of clinical placement. Ng Teng Fong General Hospital's CLEO team coordinates SIT allied-health attachments. — [SIT programme](https://www.singaporetech.edu.sg/undergraduate-programmes/physiotherapy); [MOE course page](https://www.moe.gov.sg/coursefinder/coursedetail/bs017-bachelor-of-science-with-honours-in-physiotherapy); [NTFGH](https://www.ntfgh.com.sg/research-and-education/pre-employment-clinical-education/allied-health)

### Inferences
- The strongest pitch to these buyers is less SP logistics, more practice reps before placement, and consistent scoring. The Japan SP shortage is a concrete pain point.

### Gaps
- I found no Singapore or HK data on placement slot numbers or SP cost per hour, and no educator marking-hours data.

## 3. Attitudes to AI grading and AI patients

### Takeaway
Educators are cautiously positive. Agreement studies look good (κ around 0.79–0.88), but the consistent line is "adjunct, with human oversight", suitable for formative use rather than high-stakes assessment. Doubts about empathy and nonverbal skills are explicit.

### Cited Findings
- ENPHE survey of physio educators and researchers: generally positive about AI, with concerns about privacy and bias and a need for training and institutional support. — [World Physiotherapy congress proceeding](https://world.physio/congress-proceeding/use-artificial-intelligence-physiotherapy-educators-and-researchers)
- GPT-4 versus human graders on OSCE communication transcripts: κ = 0.88. — [arXiv 2410.12858](https://arxiv.org/abs/2410.12858?context=cs)
- Post-OSCE notes: up to 89.7% agreement (κ 0.79) in a cited UT Southwestern study. The authors say educators should validate LLMs "in their local grading framework" before use. — [PMC12972204](https://pmc.ncbi.nlm.nih.gov/articles/PMC12972204/)
- Juntendo (JMIR Med Educ 2026): the lead author says text-only scoring misses tone, nonverbal communication and cultural context, so human oversight is needed. — [News-Medical](https://www.news-medical.net/news/20260415/Study-finds-AI-can-match-clinicians-in-interview-assessment.aspx); [JMIR Med Educ 2026](https://mededu.jmir.org/2026/1/e83376/PDF)
- Qualitative study of conversational AI patients: four themes (clinical authenticity, interactional limitations, educational potential, implementation). The study concluded the tool is better suited to supplementary training than to high-stakes assessment. — [Frontiers in Education 2025](https://public-pages-files-2025.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1632742/text)
- Nearly half of learners found it hard to feel real empathy with an AI patient. — [arXiv 2609.22517](https://arxiv.org/pdf/2609.22517)
- Health professionals perceived live-avatar simulation as more authentic than AI avatars. — [Duke Scholars](https://scholars.duke.edu/publication/1672580)
- Faculty perceived more educational value from VR simulation than students did, which suggests faculty can be early adopters. — [IDEAS / Simulation & Gaming 2022](https://ideas.repec.org/a/sae/simgam/v53y2022i2p111-134.html)
- Urology OSCE: ChatGPT-4 scoring aligned with blinded faculty. The authors recommend it only as an adjunct with oversight. — [JMIR preprint](https://preprints.jmir.org/preprint/100427)

### Inferences
- A manual override, faculty calibration against AI scores, and a "formative" label are likely prerequisites for trust. Empathy and nonverbal scoring will be the most contested dimensions.

### Gaps
- I found no direct evidence on fear of replacement or deskilling among PT/OT faculty specifically.

## 4. Dark side

### Takeaway
There is little direct empirical work on rubber-stamping or surveillance. What exists warns that AI feedback errors propagate to students and that governance is weak.

### Cited Findings
- Scoping review of 42 studies: LLM feedback accuracy varied, and AI errors shaped student decisions even after peer discussion. The review calls for supervision and governance. — [Gazi AI MedEd Observatory summary](https://tipegitimi.gazi.edu.tr/ai-meded-observatory/articles/applications-and-outcomes-of-large-language-model-generated-feedback-in-undergraduate-medical-education-a-scoping-review)
- The clinical groundedness of feedback in a psychotherapy simulator had not been evaluated; the authors call for "expert-auditable" feedback. — [ACL Anthology 2025](https://aclanthology.org/2025.aimecon-main.25.pdf)
- Higher-education faculty: 88–94% have concerns about learning outcomes, disciplinary fit and student cognitive offloading. — [EDUCAUSE Review 2026](https://er.educause.edu/articles/2026/4/listening-to-skepticism-what-faculty-concerns-about-generative-ai-reveal)
- AI dashboards under-address privacy, bias and explainability. — [Springer review 2025](https://link.springer.com/article/10.1007/s44217-025-00964-y)

### Inferences
- If AI scores are shown as final, overloaded staff will likely accept them unreviewed; the design should require sign-off. Liability for clinically wrong feedback is likely to fall on the institution, so audit trails matter.

### Gaps
- I found no sources on territorial or political resistance, on SP-programme staff seeing AI as a threat, or on legal liability cases.

## 5. Dashboards

### Takeaway
Teachers value non-evaluative pattern-spotting and frequent data. Autonomy and control over AI decisions are central design concerns.

### Cited Findings
- Teachers used an AI analytics dashboard to spot patterns they had missed and wanted more frequent data than observations provide. — [UVA dissertation](https://libraetd.lib.virginia.edu/public_view/oid-d7gnoqs9rrqs73g4dn70)
- Instructor autonomy is framed as six levels from full teacher control to full automation. — [arXiv 2603.22674](https://arxiv.org/html/2603.22674v1)

### Gaps
- I found no health-education evidence on which dashboard widgets are ignored.

## 6. Cultural factors (Asia)

### Takeaway
Hierarchy, collectivism and face-saving push feedback toward one-way, group-based delivery. Anonymous channels are suggested. There is very little Singapore or HK-specific evidence.

### Cited Findings
- Scoping review of 17 articles (Soemantri et al. 2022): in hierarchical, collectivist cultures, feedback tends to be one-way and group feedback is preferred. — [UTM record](https://libmast.utm.my/Record/oai:generic.eprints.org:283911/Description)
- Taiwan (Medical Education): giving feedback to clinical educators raises issues of hierarchy and face-saving; anonymous online channels may help. — [Bohrium summary](https://bohrium.dp.tech/paper/arxiv/38766732)
- Feedback literature has a North American and European focus, with few Southeast Asian studies. — [BMJ Open 2022](https://bmjopen.bmj.com/content/12/2/e049462)

### Inferences
- A private AI patient lets students fail without losing face, which may be a selling point. Cohort-level views fit group-feedback norms.

### Gaps
- I found nothing on Tung Wah College, Shinshu University or NUH specifically, and no Japanese-language sources were searched.
