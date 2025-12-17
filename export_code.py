import os

root_path = r"C:\Users\ndera\OneDrive\Pictures\fingerprint-auth"
output_file = "code.md"

extensions = {".js", ".ts", ".tsx"}

with open(output_file, "w", encoding="utf-8") as out:
    out.write("# Full Code Export (.js, .ts, .tsx)\n\n")

    for folder, _, files in os.walk(root_path):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()

            if ext in extensions:
                file_path = os.path.join(folder, filename)

                out.write(f"\n\n## File: {file_path}\n")
                out.write(f"```{ext[1:]}\n")

                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    out.write(f.read())

                out.write("\n```\n")

print("Done! Exported to code.md")
