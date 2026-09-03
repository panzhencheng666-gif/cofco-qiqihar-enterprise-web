import { useEffect, useState } from "react";

import type {
  CurrentSession,
  FormalSampleObservationDomain,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { FormalSamplePointLedger } from "../formal-sample/FormalSamplePointLedger";
import { SamplePointLedgerFilters } from "../formal-sample/SamplePointLedgerPrimitives";
import type { FormalSelection } from "../formalEnterpriseModel";

const domains = ["PRODUCTION", "MARKET", "LOGISTICS"] as const;
const domainLabels: Record<FormalSampleObservationDomain, string> = {
  PRODUCTION: "产情",
  MARKET: "市场",
  LOGISTICS: "物流",
};

export function CurrentSamplePointLedger({
  refreshSequence = 0,
  repository,
  session,
  selection,
  onSelectionChange,
  onSelectionClear,
}: {
  refreshSequence?: number;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
  selection?: FormalSelection;
  onSelectionChange?: (selection: FormalSelection) => void;
  onSelectionClear?: () => void;
}) {
  const [domain, setDomain] =
    useState<FormalSampleObservationDomain>("PRODUCTION");
  const [productCode, setProductCode] = useState("CORN");
  const [products, setProducts] = useState<
    readonly { code: string; name: string }[]
  >([{ code: "CORN", name: "玉米" }]);

  useEffect(() => {
    let active = true;
    void repository
      .loadMasterData()
      .then((master) => {
        if (!active || master.products.length === 0) return;
        setProducts(master.products);
        setProductCode((current) =>
          master.products.some(({ code }) => code === current)
            ? current
            : master.products[0].code,
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repository]);

  const resetSelection = () =>
    onSelectionChange?.({ type: "formal-sample-list", id: "list" });

  return (
    <>
      <SamplePointLedgerFilters ariaLabel="现有样本业务范围">
        <label>
          <span>业务类别</span>
          <select
            aria-label="现有样本业务类别"
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value as FormalSampleObservationDomain);
              resetSelection();
            }}
          >
            {domains.map((value) => (
              <option key={value} value={value}>
                {domainLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>产品</span>
          <select
            aria-label="现有样本产品"
            value={productCode}
            onChange={(event) => {
              setProductCode(event.target.value);
              resetSelection();
            }}
          >
            {products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </SamplePointLedgerFilters>
      <FormalSamplePointLedger
        key={`${domain}:${productCode}:${refreshSequence}`}
        domain={domain}
        permissions={session.permissions}
        productCode={productCode}
        repository={repository}
        selection={selection}
        onSelectionChange={onSelectionChange}
        onSelectionClear={onSelectionClear}
        showAllApplicableFields
        onCollectData={(samplePointId) =>
          onSelectionChange?.({
            type: "formal-sample-observation",
            id: samplePointId,
          })
        }
      />
    </>
  );
}
