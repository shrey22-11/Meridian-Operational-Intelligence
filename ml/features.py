import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

NUMERIC = ["warehouse_load","distance_km","promised_days","supplier_lead_days","units","revenue"]
CATEGORICAL = ["region","channel","expedited"]
FEATURES = NUMERIC + CATEGORICAL


def preprocessing():
    return ColumnTransformer([
        ("numeric",Pipeline([("impute",SimpleImputer(strategy="median")),
                              ("scale",StandardScaler())]),NUMERIC),
        ("category",OneHotEncoder(handle_unknown="ignore",sparse_output=False),CATEGORICAL)
    ])


def temporal_split(df):
    dates = pd.to_datetime(df.ordered_at)
    known = dates + pd.to_timedelta(df.actual_days,unit="D")
    # Label maturity: training outcomes must be observable before validation starts.
    train = df.loc[(dates < "2025-04-01") & (known < "2025-04-01")]
    valid = df.loc[(dates >= "2025-04-01") & (dates < "2025-07-01") & (known < "2025-07-01")]
    test = df.loc[(dates >= "2025-07-01") & (dates < "2025-10-01") & (known < "2025-12-01")]
    if min(len(train),len(valid),len(test)) < 100:
        raise ValueError("Not enough mature labels in train/validation/test periods.")
    return train,valid,test


def demand_features(series):
    df = pd.DataFrame({"units":series})
    df["lag7"] = series.shift(7)
    df["lag14"] = series.shift(14)
    df["mean7"] = series.shift(1).rolling(7).mean()
    df["mean28"] = series.shift(1).rolling(28).mean()
    df["weekday"] = df.index.dayofweek
    df["month"] = df.index.month
    df["dayofyear"] = df.index.dayofyear
    return df.dropna()
