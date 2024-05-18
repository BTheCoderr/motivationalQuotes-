import random

def get_random_quote():
    quotes = [
        "The only way to do great work is to love what you do. - Steve Jobs",
        "Innovation distinguishes between a leader and a follower. - Steve Jobs",
        "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
        "Stay hungry, stay foolish. - Steve Jobs",
        "I have not failed. I've just found 10,000 ways that won't work. - Thomas A. Edison",
        "Genius is one percent inspiration and ninety-nine percent perspiration. - Thomas A. Edison",
        "Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time. - Thomas A. Edison"
    ]
    return random.choice(quotes)

if __name__ == "__main__":
    print(get_random_quote())
