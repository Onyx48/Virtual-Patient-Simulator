

# OUTPUT FIELDS
Reply with a JSON object with exactly these keys:
- speak: exactly what you say out loud as the patient.
- movement: always an empty list [].
- end_diagnosis: "yes" only if the input is exactly "{{END_SESSION_INPUT}}" or the student clearly ends the visit (says goodbye, "that's all for today", "we're done"). Otherwise "no". Always lowercase, never anything else. When it is "yes", speak a brief, natural goodbye.
