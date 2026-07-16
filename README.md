# NLC Internship Projects: Downtime Analysis & Analytics Tools

This repository contains the projects and analytical tools developed during the internship at **Neyveli Lignite Corporation (NLC)**. The primary objective is to analyze machinery downtime logs, map group codes, and utilize machine learning to predict machine failure risk under varying climate conditions.

---

## Repository Overview

The repository is structured as follows:

```
├── Downtime/                        # Flask Web Application
│   ├── app_full.py                  # Main Flask entrypoint with ML logic
│   ├── requirements.txt             # Python dependencies
│   ├── templates/                   # HTML templates (Bootstrap 5)
│   └── static/                      # Static assets (Favicons, CSS, logos)
│
├── downtime-react/                  # Zero-Dependency React Application
│   ├── index.html                   # CDN bootstrap setup
│   ├── app.jsx                      # Client-side React logic (Babel)
│   ├── styles.css                   # Custom styles
│   ├── README.txt                   # Execution guide
│   └── MDS_20220401_20230531_20230705_171405.csv # Primary log dataset (31MB)
│
├── class_analysis.py                # Student mark analysis script
├── class_analysis.ipynb             # Jupyter Notebook version
├── class_scores_random.xlsx         # Generated student score spreadsheet
│
├── NLC Intership Report (4).pdf     # Official Internship Report PDF
├── detail.docx                      # Supporting documentation
├── detail1.docx                     # Supporting documentation
├── detail-10.docx                   # Supporting documentation
└── new one.docx                     # Supporting documentation
```

---

## Project Details

### 1. Downtime Analysis - Flask Web Application (`Downtime/`)
A Python Flask web application that ingests downtime log CSV files, performs data aggregation, renders interactive analytics charts, maps group codes, and generates downloadable PDF reports.

#### Key Features:
* **Interactive Dashboard**: Displays KPIs such as *Total Downtime*, *Total Issues Count*, and *Top Failing Machine*.
* **Dynamic Visualization**: Renders interactive Plotly charts:
  * Top machines by issue count
  * Total downtime distribution by climate
  * Distribution of issues by shift
  * Top 10 downtime duration by group code
  * Plant-wise & Material-wise issues
* **Machine Learning Predictive Engine**:
  * Utilizes `scikit-learn`'s **Logistic Regression** classifier.
  * Groups failures per Bucket Wheel Excavator (BWE) and classifies them against season-based climate thresholds (Summer, Monsoon, Winter).
  * Automatically calculates the current climate based on the server date.
  * Predicts the **top 5 machines at highest failure risk** under current seasonal conditions.
* **PDF Report Generation**: Uses `img2pdf` to compile static Matplotlib charts directly into a professional PDF summary.
* **Data Exports**: Provides custom CSV download utilities for aggregated failure statistics.
* **Group Code Mapping**: Decodes complex, multi-digit group codes into readable terms.

#### Setup & Run (Flask App):
1. Navigate to the `Downtime` directory:
   ```bash
   cd Downtime
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Launch the application:
   ```bash
   python app_full.py
   ```
5. Open your browser and go to `http://127.0.0.1:5000`.

---

### 2. Downtime Analysis - React Application (`downtime-react/`)
A complete, lightweight client-side port of the downtime dashboard. It requires **no npm or build systems** and runs entirely within browser memory using CDN assets (React 18, Babel standalone, PapaParse, Plotly.js).

#### Key Features:
* **Local CSV Processing**: Parses CSV files up to 100MB+ in milliseconds entirely inside browser memory using PapaParse.
* **Interactive Data Table**:
  * Global text search across all log columns.
  * Column-wise sorting (A-Z, Z-A).
  * Dynamic column-wise filtering using interactive dropdown checkbox checklists with search functions.
  * Paginated table rendering for smooth performance.
* **Synchronized Dashboard**: Displays KPIs and renders dynamic Plotly charts matching user-filtered data in real-time.
* **Excel-friendly Downloads**: Export custom sorted/filtered subsets of log files as CSV.

#### Run (React App):
1. Navigate to the `downtime-react` directory:
   ```bash
   cd downtime-react
   ```
2. Run a simple local HTTP server (using Python):
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://127.0.0.1:8080` in your web browser.
4. Click **Load Sample** or upload your local CSV log file to view the analysis.

---

### 3. Class Analysis Tool (`class_analysis.py` / `.ipynb`)
A standalone data generation and analytics script that demonstrates basic data science techniques:
* Generates a synthetic student dataset of 30 students across three classes.
* Generates marks for 5 subjects and calculates averages, percentages, and letter grades (`A+` to `D`).
* Outputs a cleaned spreadsheet `class_scores_random.xlsx`.
* Visualizes:
  * Top 5 student scorers.
  * Distribution of total marks.
  * Average performance per subject.
  * Class grade distribution.

#### Run (Class Analysis):
```bash
python3 class_analysis.py
```

---

## Dataset Description

The main log dataset (`MDS_20220401_20230531_20230705_171405.csv`) tracks Bucket Wheel Excavator (BWE) operations. Key fields include:
* `Bench`: Ground layer indicator.
* `Date`: Date of log record.
* `BWE`: Identification code of the Bucket Wheel Excavator.
* `Duration`: Downtime duration.
* `Group code` / `Group code text`: Codes and categories of failures.
* `Remarks`: Explanatory logs from operators.
* `Shift`: Shift identification (1, 2, or 3).
* `Plant`: Corresponding plant sector.
* `Material Number`: Associated parts numbers.
* `Time From` / `Time to`: Specific timestamps of downtime events.

---

## Author & Internship Context

Developed by **Sasikumar P** (B.Tech in Artificial Intelligence & Data Science, Amrita Vishwa Vidyapeetham, Coimbatore) during his internship at Neyveli Lignite Corporation (NLC).
