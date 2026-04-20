content = open('a:/SigilOS/src/components/sigil-invader/SigilInvaderGame.tsx', 'r', encoding='utf-8').read()
bracket_count = 0
for i, char in enumerate(content):
    if char == '{':
        bracket_count += 1
    elif char == '}':
        bracket_count -= 1
    if bracket_count < 0:
        print(f"Brace unbalanced at character {i}: {content[i-50:i+50]}")
        break
else:
    print(f"Final bracket count: {bracket_count}")
