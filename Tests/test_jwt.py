import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = 'a-very-secret-key-that-you-should-change'

# Test token generation
token = jwt.encode({
    'sub': str(1),
    'iat': datetime.now(timezone.utc),
    'exp': datetime.now(timezone.utc) + timedelta(days=1)
}, SECRET_KEY, algorithm="HS256")

print(f"Token type: {type(token)}")
print(f"Token value: {token}")
print(f"Token length: {len(token)}")

# Test token decoding
try:
    decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    print(f"Decoded successfully: {decoded}")
except Exception as e:
    print(f"Decode error: {e}")
