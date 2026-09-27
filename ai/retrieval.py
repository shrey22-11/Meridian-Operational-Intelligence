"""Local LSA vector retrieval: TF-IDF -> truncated SVD -> normalized dense vectors.
No external embedding API. This is a small lexical/latent-semantic index, not a neural encoder.
"""
from functools import lru_cache
import hashlib
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from backend.app.config import ROOT


def build_index():
    chunks=[]
    for path in sorted((ROOT/"ai/knowledge").glob("*.md")):
        paragraphs=path.read_text().split("\n\n")
        for chunk_number,paragraph in enumerate(paragraphs[1:],1):
            if paragraph.strip():
                chunks.append({"id":f"{path.stem}:{chunk_number}","source":path.name,"text":paragraph.strip()})
    vectorizer=TfidfVectorizer(ngram_range=(1,2),stop_words="english",sublinear_tf=True)
    matrix=vectorizer.fit_transform([c["text"] for c in chunks])
    svd=TruncatedSVD(n_components=min(32,matrix.shape[0]-1),random_state=42)
    vectors=normalize(svd.fit_transform(matrix))
    bundle={"chunks":chunks,"vectorizer":vectorizer,"svd":svd,"vectors":vectors,
        "fingerprint":hashlib.sha256(str(chunks).encode()).hexdigest()}
    (ROOT/"artifacts").mkdir(exist_ok=True)
    joblib.dump(bundle,ROOT/"artifacts/knowledge.joblib")
    index.cache_clear()
    return {"chunks":len(chunks),"dimensions":vectors.shape[1],"method":"TF-IDF + LSA dense embeddings + cosine retrieval"}


@lru_cache(maxsize=1)
def index():
    return joblib.load(ROOT/"artifacts/knowledge.joblib")


def retrieve(query,limit=3):
    store=index()
    sparse=store["vectorizer"].transform([query])
    if sparse.nnz==0:
        return []
    query_vector=normalize(store["svd"].transform(sparse))
    scores=(store["vectors"]@query_vector.T).ravel()
    return [{**store["chunks"][i],"score":float(scores[i])}
            for i in np.argsort(scores)[::-1][:limit] if scores[i]>.12]


if __name__=="__main__":
    print(build_index())
