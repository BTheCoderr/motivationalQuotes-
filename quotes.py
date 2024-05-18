import random

def get_random_quotes(num_quotes):
    quotes = [
        "The only way to do great work is to love what you do. - Steve Jobs",
        "Innovation distinguishes between a leader and a follower. - Steve Jobs",
        "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
        "Stay hungry, stay foolish. - Steve Jobs",
        "I have not failed. I've just found 10,000 ways that won't work. - Thomas A. Edison",
        "Genius is one percent inspiration and ninety-nine percent perspiration. - Thomas A. Edison",
        "Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time. - Thomas A. Edison",
        "The best way to predict the future is to invent it. - Alan Kay",
        "It's not that I'm so smart, it's just that I stay with problems longer. - Albert Einstein",
        "Success is not final, failure is not fatal: It is the courage to continue that counts. - Winston Churchill"
    ]

    num_custom_quotes = int(input("How many custom quotes do you want to add? "))
    for _ in range(num_custom_quotes):
        quote = input("Enter your custom quote: ")
        quotes.append(quote)
    
    return random.sample(quotes, num_quotes)

def save_quotes_to_file(quotes, filename):
    with open(filename, "w") as file:
        for quote in quotes:
            file.write(quote + "\n")

if __name__ == "__main__":
    num_quotes = int(input("How many quotes do you want to generate? "))
    generated_quotes = get_random_quotes(num_quotes)
    
    print("Generated Quotes:")
    for quote in generated_quotes:
        print(quote)

    save_to_file = input("Do you want to save these quotes to a file? (yes/no): ").lower()
    if save_to_file == "yes":
        filename = input("Enter the filename to save the quotes: ")
        save_quotes_to_file(generated_quotes, filename)
        print(f"Quotes saved to {filename}")
    else:
        print("Quotes not saved.")
