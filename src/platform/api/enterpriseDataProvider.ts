import type {
  BaseRecord,
  DataProvider,
  GetListParams,
  GetOneParams,
} from "@refinedev/core";
import type { EnterpriseGateway } from "@/workflows/enterprise-gateway/port";

function unsupported(operation: string): Promise<never> {
  return Promise.reject(new Error(`模拟只读数据源不支持 ${operation}`));
}

export function createEnterpriseDataProvider(
  gateway: EnterpriseGateway,
): DataProvider {
  const provider: DataProvider = {
    getApiUrl: () => "/api/v1",
    async getList<TData extends BaseRecord>({ resource }: GetListParams) {
      if (resource === "tasks") {
        const data = [...(await gateway.listTasks())] as unknown as TData[];
        return { data, total: data.length };
      }
      if (resource === "reviews") {
        const data = [
          ...(await gateway.listReviewTasks()),
        ] as unknown as TData[];
        return { data, total: data.length };
      }
      return unsupported(`getList(${resource})`);
    },
    async getOne<TData extends BaseRecord>({ resource, id }: GetOneParams) {
      if (resource === "objects") {
        return {
          data: (await gateway.getObject(String(id))) as unknown as TData,
        };
      }
      if (resource === "documents") {
        return {
          data: (await gateway.getDocument(String(id))) as unknown as TData,
        };
      }
      return unsupported(`getOne(${resource})`);
    },
    create() {
      return unsupported("create");
    },
    update() {
      return unsupported("update");
    },
    deleteOne() {
      return unsupported("deleteOne");
    },
  };
  return provider;
}
