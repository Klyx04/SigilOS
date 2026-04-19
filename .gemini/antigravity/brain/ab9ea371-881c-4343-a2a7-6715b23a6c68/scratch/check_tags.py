import re

content = open('a:/SigilOS/src/components/sigil-invader/SigilInvaderGame.tsx', 'r', encoding='utf-8').read()

# Very primitive tag balance check
tags = re.findall(r'<(/?[a-zA-Z0-9\.]+)', content)
stack = []
for tag in tags:
    if tag.startswith('/'):
        closing = tag[1:]
        if not stack:
            print(f"Extra closing tag: {tag}")
            continue
        opening = stack.pop()
        if opening != closing and opening.split('.')[0] != closing.split('.')[0]:
            print(f"Tag mismatch: {opening} closed by {tag}")
    else:
        # Ignore self-closing (we'd need a better regex for that)
        stack.append(tag)

print(f"Final stack size: {len(stack)}")
if stack:
    print(f"Unclosed tags: {stack}")
