import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


sns.set_theme(style="whitegrid")
np.random.seed(42)


def grade_from_percentage(percentage: float) -> str:
    if percentage >= 90:
        return "A+"
    if percentage >= 80:
        return "A"
    if percentage >= 70:
        return "B"
    if percentage >= 60:
        return "C"
    return "D"


student_names = [
    "Aarav", "Aisha", "Arjun", "Diya", "Ishaan", "Kavya", "Meera", "Rohan",
    "Saanvi", "Vihaan", "Anika", "Kabir", "Nisha", "Rahul", "Priya", "Dev",
    "Ira", "Siddharth", "Neha", "Krish", "Ananya", "Yash", "Pooja", "Aman",
    "Tanya", "Mohan", "Sneha", "Ved", "Riya", "Harsh",
]
classes = ["10-A", "10-B", "10-C"]
subjects = ["English", "Math", "Science", "Social", "Computer"]

records = []
for index, name in enumerate(student_names, start=1):
    marks = np.random.randint(55, 101, size=len(subjects))
    total = int(marks.sum())
    average = round(total / len(subjects), 2)
    percentage = round((total / 500) * 100, 2)
    grade = grade_from_percentage(percentage)

    records.append(
        {
            "StudentID": f"ST{index:03d}",
            "StudentName": name,
            "Class": np.random.choice(classes),
            "English": int(marks[0]),
            "Math": int(marks[1]),
            "Science": int(marks[2]),
            "Social": int(marks[3]),
            "Computer": int(marks[4]),
            "Total": total,
            "Average": average,
            "Percentage": percentage,
            "Grade": grade,
        }
    )

class_df = pd.DataFrame(records)

excel_file = "class_scores_random.xlsx"
class_df.to_excel(excel_file, index=False)
loaded_df = pd.read_excel(excel_file)

print("Dataset shape:", loaded_df.shape)
print("\nColumns:", loaded_df.columns.tolist())
print("\nMissing values:")
print(loaded_df.isnull().sum())

summary_stats = loaded_df[["English", "Math", "Science", "Social", "Computer", "Total", "Average", "Percentage"]].agg(
    ["mean", "median", "min", "max"]
)
print("\nSummary statistics:")
print(summary_stats.round(2))

top_5_scorers = loaded_df.sort_values(by="Total", ascending=False).head(5)
print("\nTop 5 scorers:")
print(top_5_scorers[["StudentID", "StudentName", "Class", "Total", "Average", "Percentage", "Grade"]].to_string(index=False))

subject_means = loaded_df[["English", "Math", "Science", "Social", "Computer"]].mean().sort_values(ascending=False)

grade_counts = loaded_df["Grade"].value_counts().sort_index()

fig, axes = plt.subplots(1, 3, figsize=(21, 6))

sns.barplot(data=top_5_scorers, x="StudentName", y="Total", palette="viridis", ax=axes[0])
axes[0].set_title("Top 5 Scorers")
axes[0].set_xlabel("Student Name")
axes[0].set_ylabel("Total Marks")
axes[0].tick_params(axis="x", rotation=45)

sns.histplot(loaded_df["Total"], bins=8, kde=True, color="steelblue", ax=axes[1])
axes[1].set_title("Distribution of Total Scores")
axes[1].set_xlabel("Total Marks")
axes[1].set_ylabel("Number of Students")

subject_means.plot(kind="bar", color="coral", ax=axes[2])
axes[2].set_title("Average Marks by Subject")
axes[2].set_xlabel("Subject")
axes[2].set_ylabel("Average Marks")
axes[2].tick_params(axis="x", rotation=45)

plt.tight_layout()
plt.savefig("class_analysis_graphs.png", dpi=200, bbox_inches="tight")
plt.show()

plt.figure(figsize=(7, 7))
plt.pie(
    grade_counts,
    labels=grade_counts.index,
    autopct="%1.1f%%",
    startangle=140,
    colors=sns.color_palette("pastel"),
)
plt.title("Grade Distribution")
plt.savefig("grade_distribution.png", dpi=200, bbox_inches="tight")
plt.show()

print("\nFiles created:")
print(f"- {excel_file}")
print("- class_analysis_graphs.png")
print("- grade_distribution.png")