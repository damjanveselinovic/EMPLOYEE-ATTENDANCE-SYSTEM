import * as ort from "onnxruntime-node";
import fs from "node:fs";
import path from "node:path";
import { computeUserFeatures, FEATURE_ORDER } from "./features.server";

const MODEL_PATH = path.join(
  process.cwd(),
  "src/lib/ml/models/burnout_model.onnx"
);
const SCHEMA_PATH = path.join(
  process.cwd(),
  "src/lib/ml/models/feature_schema.json"
);

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      // provera da se feature_schema.json poklapa sa FEATURE_ORDER - ako neko
      // kasnije promeni redosled na jednoj strani a zaboravi na drugoj, ovo puca
      // odmah i jasno, umesto da tiho vraca pogresne rezultate
      const schemaRaw = fs.readFileSync(SCHEMA_PATH, "utf-8");
      const schema = JSON.parse(schemaRaw) as { feature_order: string[] };
      const expected: readonly string[] = FEATURE_ORDER;
      const matches =
        schema.feature_order.length === expected.length &&
        schema.feature_order.every((name, i) => name === expected[i]);
      if (!matches) {
        throw new Error(
          `feature_schema.json se ne poklapa sa FEATURE_ORDER u features.server.ts.\n` +
            `Schema:    [${schema.feature_order.join(", ")}]\n` +
            `Ocekivano: [${expected.join(", ")}]`
        );
      }
      return ort.InferenceSession.create(MODEL_PATH);
    })();
  }
  return sessionPromise;
}

export type BurnoutAnalysisResult = {
  riskScore: number; // 0-1, verovatnoca "at_risk" klase
  features: Record<string, number>;
};

export async function getBurnoutRiskScore(
  userId: number
): Promise<BurnoutAnalysisResult> {
  const featureVector = await computeUserFeatures(userId);
  const session = await getSession();

  const inputTensor = new ort.Tensor(
    "float32",
    Float32Array.from(featureVector),
    [1, featureVector.length]
  );

  const output = await session.run({ input: inputTensor });

  // trazimo izlazni tenzor oblika [1, 2] (1 red, verovatnoca za 2 klase) -
  // ne oslanjamo se na tacno ime, jer ono zna da varira izmedju verzija skl2onnx-a
  let riskScore: number | null = null;
  for (const key of Object.keys(output)) {
    const tensor = output[key];
    if (tensor.dims.length === 2 && tensor.dims[1] === 2) {
      const data = tensor.data as Float32Array | Float64Array;
      riskScore = data[1]; // verovatnoca klase "1" = at_risk
      break;
    }
  }

  if (riskScore === null) {
    throw new Error(
      `Nije pronadjen tenzor verovatnoce oblika [1,2] medju ONNX izlazima. ` +
        `Dostupni izlazi: ${Object.keys(output)
          .map((k) => `${k} (dims=${output[k].dims.join("x")})`)
          .join(", ")}`
    );
  }

  const featureNames: readonly string[] = FEATURE_ORDER;
  const features: Record<string, number> = {};
  featureNames.forEach((name, i) => {
    features[name] = featureVector[i];
  });

  return { riskScore, features };
}
