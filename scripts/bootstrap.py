from pipeline.run import run
from analytics.report import build_report
from ml.train import train
from scripts.export_bi import export
from ai.retrieval import build_index


def main():
    run()
    build_report()
    train()
    export()
    print(build_index())
    print("All core data, model, BI and knowledge artifacts are ready.")


if __name__=="__main__":
    main()
