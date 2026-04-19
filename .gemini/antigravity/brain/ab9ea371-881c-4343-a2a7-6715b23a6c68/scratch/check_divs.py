import re

content = open('a:/SigilOS/src/components/sigil-invader/SigilInvaderGame.tsx', 'r', encoding='utf-8').read()

# Find all <div and </div including those inside strings (primitive)
lines = content.split('\n')
stack = []

for i, line in enumerate(lines):
    # This is a very rough approach but might help find the line
    tokens = re.findall(r'<div|</div', line)
    for token in tokens:
        if token == '<div':
            stack.append(i + 1)
        else:
            if stack:
                stack.pop()
            else:
                print(f"Extra closing div at line {i+1}")

print(f"Final unclosed divs count: {len(stack)}")
if stack:
    print(f"Unclosed divs opened at lines: {stack}")
