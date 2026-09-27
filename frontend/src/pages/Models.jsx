import { useResource } from "../hooks/useResource";
import { PageHeading, Section, Resource, ExportLink } from "../components/UI";
import { decimal, percent, number, modelName, dateLabel } from "../lib/format";
import { ForecastChart, ImportanceChart } from "../components/Charts";
import DataTable from "../components/DataTable";

function ClassifierEvaluation({ risk }) {
  const candidates = Object.entries(risk.validation_candidates).map(
    ([name, validation]) => ({
      name: modelName(name),
      validation,
      selected: name === risk.selected ? "Selected" : "Compared",
      test: name === risk.selected ? risk.test.average_precision : null,
    }),
  );
  return (
    <>
      <div className="model-summary">
        <div>
          <span className="eyebrow">01 / DELIVERY RISK</span>
          <h2>{modelName(risk.selected)}</h2>
          <p>Predicts whether an open order will miss its delivery promise.</p>
        </div>
        <div className="model-headline">
          <span>Held-out ROC AUC</span>
          <strong>{decimal(risk.test.roc_auc, 3)}</strong>
          <small>{risk.split_periods.test}</small>
        </div>
      </div>
      <dl className="stat-ledger model-ledger">
        {[
          ["Precision", percent(risk.test.precision)],
          ["Recall", percent(risk.test.recall)],
          ["Average precision", decimal(risk.test.average_precision, 3)],
          ["F1 score", decimal(risk.test.f1, 3)],
          ["Brier score", decimal(risk.test.brier, 3)],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="analysis-columns model-columns">
        <Section
          title="Model selection"
          description="Compared by validation average precision; higher is better"
        >
          <DataTable
            caption="Classifier validation comparison"
            rows={candidates}
            columns={[
              { key: "name", label: "Candidate" },
              {
                key: "validation",
                label: "Validation AP",
                numeric: true,
                render: (value) => decimal(value, 3),
              },
              {
                key: "test",
                label: "Test AP",
                numeric: true,
                render: (value) => decimal(value, 3),
              },
              { key: "selected", label: "Decision" },
            ]}
          />
          <p className="footnote">
            Only the selected model was scored on the held-out test. Delay
            prevalence: {percent(risk.test.prevalence)}.
          </p>
          <div className="split-timeline">
            {Object.entries(risk.split_sizes).map(([name, size]) => (
              <div key={name}>
                <span>{name}</span>
                <b>{number(size)}</b>
                <small>{risk.split_periods[name]}</small>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="What influences the classifier?"
          description="Validation permutation importance · average-precision loss"
        >
          <ImportanceChart rows={risk.feature_importance} />
          <p className="footnote">
            A larger value means shuffling that input reduced validation
            performance. It does not establish a causal effect.
          </p>
        </Section>
      </div>
      <div className="model-details">
        <div>
          <h3>Decision threshold</h3>
          <p>
            Flag an order for review at{" "}
            <strong>{percent(risk.threshold)}</strong> predicted delay
            probability. The illustrative cost of a missed delay is three times
            that of a false alert.
          </p>
        </div>
        <div>
          <h3>Test outcomes</h3>
          <div className="confusion-matrix">
            <table>
              <caption className="sr-only">
                Confusion matrix: actual outcomes by predicted outcomes
              </caption>
              <thead>
                <tr>
                  <th />
                  <th scope="col">Predicted on-time</th>
                  <th scope="col">Predicted delayed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Actual on-time</th>
                  <td>{number(risk.test.confusion_matrix[0][0])}</td>
                  <td>{number(risk.test.confusion_matrix[0][1])}</td>
                </tr>
                <tr>
                  <th scope="row">Actual delayed</th>
                  <td>{number(risk.test.confusion_matrix[1][0])}</td>
                  <td>{number(risk.test.confusion_matrix[1][1])}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
export default function Models({ revision }) {
  const models = useResource("models", revision);
  const forecast = useResource("forecast", revision);
  return (
    <>
      <PageHeading
        eyebrow="MODEL REGISTRY"
        title="Prediction, with its evidence"
        description="Inspect validation choices, held-out results and the limits of each model."
        action={<ExportLink dataset="forecast">Export forecast</ExportLink>}
      />
      <div className="notice-line">
        <span className="notice-mark">i</span>
        <p>
          Evaluated on synthetic retail data. These results verify the modeling
          workflow; they do not establish real-world business performance.
        </p>
      </div>
      <Resource resource={models} label="Model evaluations">
        {(report) => (
          <>
            <div className="model-sheet">
              <ClassifierEvaluation risk={report.risk} />
            </div>
            <div className="model-sheet">
              <div className="model-summary">
                <div>
                  <span className="eyebrow">02 / DEMAND FORECAST</span>
                  <h2>{modelName(report.forecast.selected)}</h2>
                  <p>Predicts daily net booked units across the portfolio.</p>
                </div>
                <div className="model-headline">
                  <span>One-day test MAE</span>
                  <strong>
                    {decimal(report.forecast.test.mae)}
                    <em>units</em>
                  </strong>
                  <small>
                    Seasonal baseline:{" "}
                    {decimal(report.forecast.seasonal_baseline_test.mae)} units
                  </small>
                </div>
              </div>
              <div className="analysis-columns">
                <Section
                  title="Demand outlook"
                  description="Fourteen days after the observed snapshot"
                >
                  <Resource resource={forecast} label="Demand forecast">
                    {(rows) => <ForecastChart rows={rows} />}
                  </Resource>
                  <p className="footnote">
                    Planning bounds widen with the horizon. Coverage has not
                    been validated for multi-day forecasts.
                  </p>
                </Section>
                <Section
                  title="Forecast selection"
                  description="Compared by validation mean absolute error; lower is better"
                >
                  <DataTable
                    caption="Forecast validation comparison"
                    rows={Object.entries(report.forecast.validation_mae).map(
                      ([name, mae]) => ({
                        name: modelName(name),
                        validation: mae,
                        decision:
                          name === report.forecast.selected
                            ? "Selected"
                            : "Compared",
                      }),
                    )}
                    columns={[
                      { key: "name", label: "Candidate" },
                      {
                        key: "validation",
                        label: "Validation MAE",
                        numeric: true,
                        render: decimal,
                      },
                      { key: "decision", label: "Decision" },
                    ]}
                  />
                  <dl className="definition-list">
                    <div>
                      <dt>Test RMSE</dt>
                      <dd>{decimal(report.forecast.test.rmse)} units</dd>
                    </div>
                    <div>
                      <dt>Test R²</dt>
                      <dd>{decimal(report.forecast.test.r2, 3)}</dd>
                    </div>
                  </dl>
                  <p className="footnote">
                    The test uses observed past lags for one-day predictions.
                    The outlook recursively uses predicted values, so its error
                    can differ.
                  </p>
                </Section>
              </div>
            </div>
            <div className="analysis-columns secondary-models">
              <Section
                title="Anomaly detection"
                description={report.anomaly.method}
              >
                <dl className="definition-list">
                  <div>
                    <dt>Reference history ends</dt>
                    <dd>{dateLabel(report.anomaly.reference_end)}</dd>
                  </div>
                  <div>
                    <dt>Reference alert budget</dt>
                    <dd>{percent(report.anomaly.contamination)}</dd>
                  </div>
                </dl>
                <p className="footnote">{report.anomaly.warning}</p>
              </Section>
              <Section
                title="Customer segmentation"
                description={report.segmentation.method}
              >
                <dl className="definition-list">
                  <div>
                    <dt>Behavioral groups</dt>
                    <dd>{report.segmentation.clusters}</dd>
                  </div>
                  <div>
                    <dt>Snapshot</dt>
                    <dd>{dateLabel(report.segmentation.as_of)}</dd>
                  </div>
                </dl>
                <p className="footnote">
                  Descriptive RFM groups; no supervised churn or retention
                  claim.
                </p>
              </Section>
            </div>
            <details className="disclosure">
              <summary>Reproducibility and training details</summary>
              <p className="metadata">
                Pipeline run: <code>{report.pipeline_run_id}</code> · Python{" "}
                {report.python} · scikit-learn {report.sklearn}
              </p>
              <p>
                Training inputs use information available when an order is
                placed. Outcome dates are checked at split boundaries; held-out
                test data is excluded from classifier fitting and threshold
                selection.
              </p>
            </details>
          </>
        )}
      </Resource>
    </>
  );
}
