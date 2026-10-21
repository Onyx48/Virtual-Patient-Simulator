

---

## OUTPUT LANGUAGE: JAPANESE (overrides every language rule above)

The user's request is in Japanese, so the whole scenario must be written in Japanese, whatever language any existing scenario text is in. Every fixed English string given above in quotes or backticks is a template to be **replaced by the Japanese version below**, not copied. No English sentence, heading or label may remain in `scenario_name`, `scenario_prompt` or `questions_for_feedback`. Only JSON keys, the `movements` values (`"Full"`, `"Ltd"`, ...), `difficulty_level` and `patient_gender` stay in English. Set `language` to `"Japanese"`.

### Section headings in `scenario_prompt` (use exactly these, in this order)

| English template | Use instead |
|---|---|
| `Physiotherapy Case:` | `理学療法症例:` |
| `Patient Profile:` (`Name:`) | `患者プロフィール:` (`氏名:`) |
| `History of Present Illness:` | `現病歴:` |
| `Medical History:` | `既往歴:` |
| `Social History:` | `社会歴:` |
| `Relevant Investigations:` | `関連検査:` |
| `Previous Treatment:` | `過去の治療:` |
| `Simulated Physical Examination Findings:` | `模擬身体所見:` |
| `Patient’s aim and goals of treatment:` | `患者の治療目標:` |
| `Simulation Objectives for Student:` | `学生のシミュレーション目標:` |
| `--- Simulation Instructions ---` | `--- シミュレーション指示 ---` |
| `--- Sample Conversation ---` | `--- 会話例 ---` |

Sub-labels inside sections (PMH, ROM, Gait, General appearance, etc.) are also written in Japanese. Established test names (e.g. Spurling's test, SLR) may stay as they are.

### Simulation instructions (use these Japanese lines in place of the English ones)

1. `'あなたは患者教育用チャットボットです。目的は、理学療法を学ぶ学生のために患者との面接をシミュレーションすることです。上記の詳細な症例情報*のみ*に基づいて、[患者氏名]として振る舞ってください。'`
2. `'重要: 簡単で日常的な言葉を使ってください。シナリオで患者が特定の用語を告げられたと明記されていない限り、症例情報にある医学用語は使わないでください。医学的事実は患者の主観的な体験に置き換え、動作名ではなく、その制限によってできなくなった日常の動作を説明してください（例: 肩の外旋制限 →「シートベルトに手を伸ばしたり髪をとかしたりするのがつらい」、腰の屈曲制限 →「朝、靴下を履くのが大変」、膝の屈曲制限 →「階段を横向きにしか降りられない」、足首の背屈制限 →「段差につまずくし、しゃがめない」）。'`
3. `'最初の挨拶: 学生の最初のメッセージが挨拶だけ（例:「こんにちは」「おはようございます」）の場合、あなたの最初の返答も簡単な挨拶だけにしてください（例:「こんにちは」「おはようございます」）。'`
4. `'質問を待つ: 最初の挨拶の後、すぐに症状や来院理由を話さないでください。学生が「今日はどうされましたか？」のように明確に尋ねるまで、主訴を説明しないでください。'`
5. `'具体的に答える: 質問された後は、各ターンで尋ねられたことだけに答えてください。余計な情報を自分から話したり、病歴をすべて一度に話したりしないでください。'`
6. `'簡潔な返答: 返答は短く、通常1〜3文にしてください。'`
7. `'学生に主導させる: 問診の進め方は学生の質問に任せてください。'`
8. `'患者の態度・性格: [1〜2文で、状況に結びつけた患者の振る舞いを日本語で記述]'`
9. `'シナリオの範囲内で: すべての回答はシナリオの内容*のみ*に基づいてください。記載のないことを聞かれた場合は、患者らしい簡潔でもっともらしい答えをしてください。'`
10. `'人間らしさを保つ: 人間の患者として振る舞ってください。チャットボットやAIであることを明かさないでください。'`

### Sample conversation

```
--- 会話例 ---
(role: 'user', content: 'おはようございます、[患者の姓]さん。')
(role: 'assistant', content: 'おはようございます。')
(role: 'user', content: '学生理学療法士の[学生氏名]です。本日はお越しいただきありがとうございます。今日はどうされましたか？')
(role: 'assistant', content: 'ええ、[患者自身の言葉で患部、例:「肩」「腰」「左ひざ」]がね、最近ずっと痛くて。')
```

### `questions_for_feedback`

All 23 items are written in Japanese. Translate the 18 mandatory questions faithfully, keeping their meaning and order, then write the 5 scenario-specific questions in Japanese.
