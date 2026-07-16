import os
from flask import Flask, render_template, request, redirect, url_for
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from collections import defaultdict
from datetime import datetime
import plotly.express as px
import plotly.io as pio
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import img2pdf

app = Flask(__name__)
BASE_DIR = os.path.dirname(__file__)
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
STATIC_FOLDER = os.path.join(BASE_DIR, 'static')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.static_folder = STATIC_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STATIC_FOLDER, exist_ok=True)


def load_and_prepare(path):
    df = pd.read_csv(path, dtype=str)
    df.columns = df.columns.str.strip()

    if 'Duration' in df.columns:
        df['Duration'] = pd.to_numeric(df['Duration'], errors='coerce').fillna(0)
    else:
        df['Duration'] = 0

    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        df = df.dropna(subset=['Date'])
        df['Month'] = df['Date'].dt.month
    else:
        df['Month'] = pd.NA

    for c in ['BWE','Group code text','Remarks','Shift','Plant','Material Number']:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip()
        else:
            df[c] = ''

    def get_climate(m):
        try:
            m = int(m)
        except Exception:
            return 'Unknown'
        if m in [3,4,5,6]:
            return 'Summer'
        elif m in [7,8,9]:
            return 'Monsoon'
        else:
            return 'Winter'

    df['Climate'] = df['Month'].apply(get_climate)

    df.attrs['get_climate'] = get_climate

    return df


def save_plot(fig, filename):
    path = os.path.join(STATIC_FOLDER, filename)
    fig.savefig(path, bbox_inches='tight')
    plt.close(fig)
    return os.path.relpath(path, BASE_DIR)


def save_plotly(fig, filename_png):
    path = os.path.join(STATIC_FOLDER, filename_png)
    img_bytes = pio.to_image(fig, format='png')
    with open(path, 'wb') as f:
        f.write(img_bytes)
    html_div = pio.to_html(fig, include_plotlyjs='cdn', full_html=False)
    return html_div, os.path.relpath(path, BASE_DIR)


def plot_top_machines(df, top_n=8):
    counts = df['BWE'].value_counts().head(top_n)
    fig = px.bar(x=counts.index, y=counts.values, labels={'x':'Machine','y':'Count'}, title='Top Machines (by issue count)')
    fig.update_layout(xaxis_tickangle=-45)
    html, img = save_plotly(fig, 'top_machines.png')
    return html, img


def plot_climate_downtime(df):
    climate = df.groupby('Climate')['Duration'].sum().reset_index()
    fig = px.bar(climate, x='Climate', y='Duration', title='Total Downtime by Climate', color='Climate')
    html, img = save_plotly(fig, 'climate_downtime.png')
    return html, img


def plot_shift_distribution(df):
    counts = df['Shift'].value_counts().reset_index()
    counts.columns = ['Shift','Count']
    fig = px.pie(counts, names='Shift', values='Count', title='Distribution of Issues by Shift')
    html, img = save_plotly(fig, 'shift_distribution.png')
    return html, img


def plot_top_group_codes(df):
    group = df.groupby('Group code text')['Duration'].sum().sort_values(ascending=False).head(10).reset_index()
    group.columns = ['Group','Duration']
    fig = px.bar(group, x='Group', y='Duration', title='Top 10 Downtime by Group Code')
    fig.update_layout(xaxis_tickangle=-45)
    html, img = save_plotly(fig, 'top10_group_codes.png')
    return html, img


def plot_plant_distribution(df):
    counts = df['Plant'].value_counts().reset_index()
    counts.columns = ['Plant','Count']
    fig = px.pie(counts.head(8), names='Plant', values='Count', title='Plant-wise Distribution of Issues')
    html, img = save_plotly(fig, 'plant_distribution.png')
    return html, img


def plot_material_distribution(df):
    counts = df['Material Number'].value_counts().reset_index()
    counts.columns = ['Material','Count']
    fig = px.pie(counts.head(8), names='Material', values='Count', title='Material-wise Issues')
    html, img = save_plotly(fig, 'material_distribution.png')
    return html, img


def compute_avg_downtime(df):
    summary = df.groupby('BWE').agg({'Duration':'sum','BWE':'count'}).rename(columns={'BWE':'Failure Count'})
    summary['Avg Downtime'] = summary['Duration'] / summary['Failure Count']
    return summary.sort_values(by='Duration', ascending=False).reset_index()


def top_issues_per_machine(df, top_m=8):
    counts_Mac = df['BWE'].value_counts()
    top_machines = counts_Mac.head(top_m).index.tolist()
    df_top = df[df['BWE'].isin(top_machines)]
    analysis = (
        df_top
        .groupby(['BWE','Group code text','Remarks'])
        .size()
        .reset_index(name='Count')
        .sort_values(by='Count', ascending=False)
    )
    top5 = analysis.groupby('BWE').head(5).reset_index(drop=True)
    return top5


def compute_groupcode_mapping(path):
    """Return mapping: {position: {digit: set(words)}}"""
    try:
        df = pd.read_csv(path, dtype={'Group code': str})
    except Exception:
        return {}

    mapping = defaultdict(lambda: defaultdict(set))
    for _, row in df.iterrows():
        gc = str(row.get('Group code', '')).zfill(2)
        text = str(row.get('Group code text', '')).strip().lower()
        words = text.replace('.', ' ').split()
        if len(gc) != len(words):
            continue
        for i in range(len(gc)):
            digit = gc[i]
            word = words[i].capitalize()
            mapping[i+1][digit].add(word)

    out = {}
    for pos, vals in mapping.items():
        out[pos] = {d: sorted(list(w)) for d, w in vals.items()}
    return out


def get_latest_uploaded_csv():
    csv_files = [
        fn for fn in os.listdir(UPLOAD_FOLDER)
        if fn.lower().endswith('.csv')
    ]
    if not csv_files:
        return None
    return max(csv_files, key=lambda fn: os.path.getmtime(os.path.join(UPLOAD_FOLDER, fn)))

@app.route('/', methods=['GET','POST'])
def index():
    if request.method == 'POST':
        f = request.files.get('file')
        if not f:
            return render_template('index.html', error='No file uploaded')
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], f.filename)
        f.save(save_path)
        return redirect(url_for('analysis', filename=f.filename))
    return render_template('index.html')


@app.route('/mapping')
def mapping():
    filename = request.args.get('filename')
    if not filename:
        filename = get_latest_uploaded_csv()
        if not filename:
            return render_template('mapping.html', mapping={}, filename='', error='No uploaded CSV file found. Please upload a CSV file first.')

    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(path):
        filename = get_latest_uploaded_csv()
        if not filename:
            return render_template('mapping.html', mapping={}, filename='', error='File not found.')
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    mapping = compute_groupcode_mapping(path)
    return render_template('mapping.html', mapping=mapping, filename=filename)


@app.route('/download/csv/<view>')
def download_csv(view):
    filename = request.args.get('filename')
    if not filename:
        return ('No filename provided', 400)
    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(path):
        return ('File not found', 404)
    df = load_and_prepare(path)
    if view == 'top5':
        out_df = top_issues_per_machine(df)
    elif view == 'plant':
        out_df = df['Plant'].value_counts().reset_index().rename(columns={'index':'Plant','Plant':'Count'})
    elif view == 'material':
        out_df = df['Material Number'].value_counts().reset_index().rename(columns={'index':'Material','Material Number':'Count'})
    elif view == 'avgdowntime':
        out_df = compute_avg_downtime(df)
    elif view == 'mapping':
        mapping = compute_groupcode_mapping(path)
        rows = []
        for pos, details in mapping.items():
            for digit, words in details.items():
                rows.append({'Position': pos, 'Digit': digit, 'Words': ', '.join(words)})
        out_df = pd.DataFrame(rows)
    else:
        return ('Unknown view', 400)
    csv = out_df.to_csv(index=False)
    out_name = f"{view}_{filename}"
    if not out_name.lower().endswith('.csv'):
        out_name += '.csv'
    return (csv, 200, {
        'Content-Type':'text/csv',
        'Content-Disposition': f'attachment; filename="{out_name}"'
    })


@app.route('/download/pdf')
def download_pdf():
    filename = request.args.get('filename')
    if not filename:
        return ('No filename provided', 400)
    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(path):
        return ('File not found', 404)
    df = load_and_prepare(path)
    figs = []
    try:
        tm_html, tm_png = plot_top_machines(df)
        cl_html, cl_png = plot_climate_downtime(df)
        sh_html, sh_png = plot_shift_distribution(df)
        g_html, g_png = plot_top_group_codes(df)
        pl_html, pl_png = plot_plant_distribution(df)
        ma_html, ma_png = plot_material_distribution(df)
        pngs = [tm_png, cl_png, sh_png, g_png, pl_png, ma_png]
        png_paths = [os.path.join(BASE_DIR, p) for p in pngs]
        safe_name = filename
        if safe_name.lower().endswith('.csv'):
            safe_name = safe_name[:-4]
        pdf_bytes_path = os.path.join(STATIC_FOLDER, f'report_{safe_name}.pdf')
        try:
            with open(pdf_bytes_path, 'wb') as f:
                f.write(img2pdf.convert(png_paths))
            with open(pdf_bytes_path, 'rb') as f:
                data = f.read()
        except Exception as ie:
            raise
        return (data, 200, {
            'Content-Type':'application/pdf',
            'Content-Disposition': f'attachment; filename="report_{safe_name}.pdf"'
        })
    except Exception as e:
        return (f'Error generating PDF: {e}', 500)

@app.route('/analysis', methods=['GET', 'POST'])
def analysis():
    filename = request.args.get('filename')
    if not filename:
        return render_template('index.html', error='No file provided. Please upload a CSV file first.')

    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(path):
        return render_template('index.html', error='File not found: ' + filename)

    df = load_and_prepare(path)

    mapping = compute_groupcode_mapping(path)
    df.attrs['groupcode_mapping'] = mapping

    top_machines_html, top_machines_img = plot_top_machines(df)
    climate_html, climate_img = plot_climate_downtime(df)
    shift_html, shift_img = plot_shift_distribution(df)
    top10_group_html, top10_group_img = plot_top_group_codes(df)
    plant_html, plant_img = plot_plant_distribution(df)
    material_html, material_img = plot_material_distribution(df)

    avg_dt_df = compute_avg_downtime(df)

    top5_table = top_issues_per_machine(df).to_html(classes='table table-sm table-striped', index=False, border=0)
    avg_dt_table = avg_dt_df.to_html(classes='table table-sm table-striped', index=False, border=0)

    try:
        total_downtime = float(df['Duration'].sum())
    except Exception:
        total_downtime = 0.0
    total_issues = len(df)
    try:
        top_machine = df['BWE'].value_counts().idxmax()
    except Exception:
        top_machine = ''

    now_month = datetime.now().month
    def _get_climate_from_month(m):
        if m in [3,4,5,6]:
            return 'Summer'
        elif m in [7,8,9]:
            return 'Monsoon'
        else:
            return 'Winter'

    current_climate = _get_climate_from_month(now_month)
    pivot = df.groupby(['BWE','Climate']).size().unstack(fill_value=0)
    preds = []
    pivot_features = pivot.copy()
    pivot_features.columns = [f'cnt_{c}' for c in pivot_features.columns]
    X = pivot_features.fillna(0)
    prob_series = pd.Series(0, index=X.index, dtype=float)
    for clim in pivot.columns:
        y = (pivot[clim] >= pivot[clim].quantile(0.7)).astype(int)
        if y.sum() < 2:
            continue
        try:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            model = LogisticRegression(max_iter=200)
            model.fit(X_train, y_train)
            probs = model.predict_proba(X)[:,1]
            prob_series = prob_series.add(pd.Series(probs, index=X.index), fill_value=0)
        except Exception:
            continue
    if len(pivot.columns) > 0:
        prob_series = prob_series / len(pivot.columns)
    prob_series = prob_series.sort_values(ascending=False)
    climate_counts = prob_series.head(5).index.tolist()

    return render_template('analysis.html',
                           top_machines_html=top_machines_html,
                           climate_html=climate_html,
                           shift_html=shift_html,
                           top10_group_html=top10_group_html,
                           plant_html=plant_html,
                           material_html=material_html,
                           top_machines_img=top_machines_img,
                           climate_img=climate_img,
                           shift_img=shift_img,
                           top10_group_img=top10_group_img,
                           top5_table=top5_table,
                           avg_dt_table=avg_dt_table,
                           filename=filename,
                           predicted_machines=climate_counts,
                           current_climate=current_climate,
                           total_downtime=total_downtime,
                           total_issues=total_issues,
                           top_machine=top_machine)



if __name__ == '__main__':
    app.run(debug=True)
