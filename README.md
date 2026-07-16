# NLC Internship — Downtime Analysis & Analytics Tools

> Analytical tools developed during the internship at **Neyveli Lignite Corporation (NLC)** to analyze machinery downtime logs, map group codes, and predict machine failure risk under varying climate conditions.

---

## Repository Structure

```
├── Downtime/                        # Flask Web Application
│   ├── app_full.py                  # Main Flask entrypoint with ML logic
│   ├── requirements.txt             # Python dependencies
│   ├── templates/                   # HTML templates (Bootstrap 5)
│   │   ├── base.html                # Base layout
│   │   ├── index.html               # Upload page
│   │   ├── dashboard.html           # Dashboard view
│   │   ├── analysis.html            # Static analysis view
│   │   ├── analysis-dynamic.html    # Dynamic analysis view
│   │   └── mapping.html             # Group code mapping view
│   └── static/                      # Static assets (Favicons, CSS, logos)
│       ├── favicon.svg
│       ├── logo.svg
│       └── ui.css
│
├── downtime-react/                  # Zero-Dependency React Application
│   ├── index.html                   # CDN bootstrap setup
│   ├── app.jsx                      # Client-side React logic (Babel)
│   ├── styles.css                   # Custom styles
│   └── README.txt                   # Execution guide
│
├── Downtime/Downtime_analysis.ipynb # Jupyter Notebook for exploratory analysis
└── detail-10.docx                   # Supporting documentation
```

> **Note:** The primary dataset (`MDS_20220401_20230531_20230705_171405.csv`, ~31 MB) is excluded from this repository. Place it in the project root or the `downtime-react/` directory as needed.

---

## Project Details

### 1. Downtime Analysis — Flask Web Application (`Downtime/`)

A Python Flask web application that ingests downtime log CSV files, performs data aggregation, renders interactive analytics charts, maps group codes, and generates downloadable PDF reports.

#### Key Features

- **Interactive Dashboard** — KPIs such as *Total Downtime*, *Total Issues Count*, and *Top Failing Machine*.
- **Dynamic Visualization** — Interactive Plotly charts:
  - Top machines by issue count
  - Total downtime distribution by climate
  - Distribution of issues by shift
  - Top 10 downtime duration by group code
  - Plant-wise & Material-wise issues
- **Machine Learning Predictive Engine**:
  - Uses `scikit-learn` **Logistic Regression** to classify failures per BWE against season-based climate thresholds (Summer, Monsoon, Winter).
  - Automatically detects the current climate from the server date.
  - Predicts the **top 5 machines at highest failure risk** under current seasonal conditions.
- **PDF Report Generation** — Compiles static Matplotlib charts into a professional PDF summary via `img2pdf`.
- **Data Exports** — Custom CSV download utilities for aggregated failure statistics.
- **Group Code Mapping** — Decodes complex, multi-digit group codes into readable terms.

#### Setup & Run

```bash
cd Downtime
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app_full.py
```

Open your browser at `http://127.0.0.1:5000`.

---

### 2. Downtime Analysis — React Application (`downtime-react/`)

A complete, lightweight client-side port of the downtime dashboard. It requires **no npm or build systems** and runs entirely in-browser using CDN assets (React 18, Babel standalone, PapaParse, Plotly.js).

#### Key Features

- **Local CSV Processing** — Parses CSV files up to 100 MB+ in milliseconds entirely inside browser memory using PapaParse.
- **Interactive Data Table**:
  - Global text search across all log columns.
  - Column-wise sorting (A→Z, Z→A).
  - Dynamic column-wise filtering with dropdown checkbox checklists and search.
  - Paginated table rendering for smooth performance.
- **Synchronized Dashboard** — Displays KPIs and renders dynamic Plotly charts matching user-filtered data in real-time.
- **Excel-friendly Downloads** — Export sorted/filtered subsets as CSV.

#### Run

```bash
cd downtime-react
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080` and click **Load Sample** or upload your CSV log file.

---

## Dataset Description

The main log dataset (`MDS_20220401_20230531_20230705_171405.csv`) tracks Bucket Wheel Excavator (BWE) operations. Key fields include:

| Field | Description |
|---|---|
| `Bench` | Ground layer indicator |
| `Date` | Date of log record |
| `BWE` | Identification code of the Bucket Wheel Excavator |
| `Duration` | Downtime duration |
| `Group code` / `Group code text` | Codes and categories of failures |
| `Remarks` | Explanatory logs from operators |
| `Shift` | Shift identification (1, 2, or 3) |
| `Plant` | Corresponding plant sector |
| `Material Number` | Associated parts numbers |
| `Time From` / `Time to` | Specific timestamps of downtime events |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python, Flask, Pandas, Matplotlib, Plotly, scikit-learn, img2pdf |
| **Frontend (Flask)** | Bootstrap 5, Plotly.js |
| **Frontend (React)** | React 18, Babel Standalone, PapaParse, Plotly.js |

---

## Author

Developed by **Sasikumar P**  
B.Tech in Artificial Intelligence & Data Science  
Amrita Vishwa Vidyapeetham, Coimbatore  
Internship at Neyveli Lignite Corporation (NLC)
