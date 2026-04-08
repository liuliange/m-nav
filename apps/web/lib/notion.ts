/* eslint-disable @typescript-eslint/no-explicit-any */

import { NotionAPI } from 'notion-client';
import { Collection, ExtendedRecordMap } from 'notion-types';
import { idToUuid, getPageTitle } from 'notion-utils';
import { cache } from 'react';

// Initialize the Notion client
const notion = new NotionAPI({
  authToken: process.env.NOTION_TOKEN,
  userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

// Helper function to get all page IDs from a collection
// Refactored to handle new Notion data format with multiple fallback strategies.
export default function getAllPageIds(
  collectionQuery: Record<string, any> | undefined,
  collectionId: string | undefined,
  collectionView: Record<string, any> | undefined,
  viewIds: string[] | undefined,
): string[] {
  const pageSet = new Set<string>();

  try {
    // ── Strategy 1: read page_sort from collectionView[viewId].value.value (new format) ──
    if (collectionView && viewIds && viewIds.length > 0) {
      const targetViewId = viewIds[0]!;
      const pageSort = (collectionView as any)?.[targetViewId]?.value?.value
        ?.page_sort;
      if (Array.isArray(pageSort) && pageSort.length > 0) {
        pageSort.forEach((id: string) => pageSet.add(id));
      }
    }

    // ── Strategy 2: iterate every view's page_sort as a fallback ──
    if (pageSet.size === 0 && collectionView) {
      Object.values(collectionView).forEach((viewEntry: any) => {
        const pageSort = viewEntry?.value?.value?.page_sort;
        if (Array.isArray(pageSort)) {
          pageSort.forEach((id: string) => pageSet.add(id));
        }
      });
    }

    // ── Strategy 3: legacy collectionQuery support ──
    if (pageSet.size === 0 && collectionQuery && collectionId) {
      const viewQuery = (collectionQuery as any)?.[collectionId];
      if (viewQuery) {
        Object.values(viewQuery).forEach((viewData: any) => {
          [
            viewData?.collection_group_results?.blockIds,
            viewData?.results?.blockIds,
            viewData?.blockIds,
          ].forEach((ids) => {
            if (Array.isArray(ids))
              ids.forEach((id: string) => pageSet.add(id));
          });
        });

        // Also support grouped table/list views (table_groups / list_groups)
        if (pageSet.size === 0 && viewIds && viewIds.length > 0) {
          const view = viewQuery[viewIds[0]!] as any;
          const tableGroups = view?.table_groups || view?.list_groups;
          if (tableGroups?.results) {
            for (const group of tableGroups.results) {
              if (!group?.value?.value) continue;
              const title = group.value.value.value || '';
              const items: string[] =
                view[`results:text:${title}`]?.blockIds || [];
              items.forEach((id) => pageSet.add(id));
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching page IDs:', error);
    return [];
  }

  return [...pageSet];
}

// Helper function to get page properties
function getPageProperties(
  pageId: string,
  value: any,
  schema: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prefix = '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pageProperties: any[] = [],
) {
  if (!value || !schema) return null;

  const propertyMap: Record<string, any> = {};

  Object.keys(schema).forEach((key) => {
    const propertyValue = value.properties?.[key]?.[0]?.[0];
    const propertyName = schema[key]?.name;

    if (propertyName) {
      propertyMap[propertyName.toLowerCase()] = propertyValue;
    }
  });

  return {
    id: pageId,
    title: propertyMap.title || propertyMap.name || '',
    description: propertyMap.description || propertyMap.desc || '',
    link: propertyMap.link || propertyMap.url || '',
    type: propertyMap.type || propertyMap.category || 'other',
  };
}

export interface DatabaseItem {
  id: string;
  title: string;
  description: string;
  link: string;
  type: string;
}

export interface PageData {
  title: string;
  description: string;
  items: Record<string, DatabaseItem[]>;
}

// Unwrap a record entry across the various Notion data formats:
//   New:    { spaceId, value: { value: { id, ... }, role } }
//   Mid:    { value: { id, ... }, role }
//   Legacy: { value: { id, ... } }
function unwrapEntry(entry: any): { value: any; role: string } | null {
  if (!entry) return null;

  // New double-nested format
  if (entry?.value?.value?.id && entry?.value?.role !== undefined) {
    return {
      value: entry.value.value,
      role: entry.value.role ?? 'reader',
    };
  }

  // Mid/legacy format with direct value.id
  if (entry?.value?.id) {
    return {
      value: entry.value,
      role: entry.role ?? 'reader',
    };
  }

  return null;
}

export function normalizeRecordMap(recordMap: ExtendedRecordMap): void {
  // Normalize blocks
  for (const blockId of Object.keys(recordMap.block)) {
    const entry = recordMap.block[blockId] as any;
    const unwrapped = unwrapEntry(entry);
    if (unwrapped) {
      // Strip crdt_* fields that react-notion-x cannot handle
      delete unwrapped.value.crdt_data;
      delete unwrapped.value.crdt_format_version;
      recordMap.block[blockId] = unwrapped as any;
    }
  }

  // Normalize collections (same pattern can occur)
  if (recordMap.collection) {
    for (const collectionId of Object.keys(recordMap.collection)) {
      const entry = recordMap.collection[collectionId] as any;
      const unwrapped = unwrapEntry(entry);
      if (unwrapped) {
        recordMap.collection[collectionId] = unwrapped as any;
      }
    }
  }
}

const getPageDataInternal = async (): Promise<PageData> => {
  if (!process.env.NOTION_PAGE_ID) {
    throw new Error('NOTION_PAGE_ID is not defined in environment variables');
  }

  const envPageId = process.env.NOTION_PAGE_ID;
  const pageId = idToUuid(envPageId);

  try {
    // Fetch the page data with additional options
    const recordMap = await notion.getPage(pageId, {
      fetchCollections: true,
      fetchMissingBlocks: true,
    });

    normalizeRecordMap(recordMap);

    // Get collection data
    const collection = Object.values(recordMap.collection)[0]?.value as
      | Collection
      | undefined;
    const collectionQuery = recordMap.collection_query;
    const block = recordMap.block;
    const schema = collection?.schema;
    const rawMetadata = block[pageId]?.value as any;
    const collectionView = recordMap.collection_view;
    const collectionId = Object.keys(recordMap.collection)[0];
    const viewIds = rawMetadata?.view_ids as string[] | undefined;

    // Get page title and icon
    const title =
      getPageTitle(recordMap) ||
      rawMetadata?.properties?.title?.[0]?.[0] ||
      'Navigation';
    const description = rawMetadata?.format?.seo_description || '';

    // Get all page IDs from the collection
    const pageIds = getAllPageIds(
      collectionQuery,
      collectionId || '',
      collectionView,
      viewIds || [],
    );

    // Process items by type
    const itemsByType: Record<string, DatabaseItem[]> = {};

    pageIds.forEach((id: string) => {
      const blockItem = block[id];
      if (!blockItem) return;

      const value = blockItem.value;
      if (!value) return;

      const props = getPageProperties(
        id,
        value,
        schema,
        '',
        collection?.format?.collection_page_properties,
      );
      if (!props) return;

      const type = props.type || 'other';

      if (!itemsByType[type]) {
        itemsByType[type] = [];
      }

      itemsByType[type].push(props);
    });

    return {
      title,
      description,
      items: itemsByType,
    };
  } catch (error) {
    console.error('Error fetching Notion data:', error);
    throw error;
  }
};

// 使用 React cache 包装函数，确保在同一请求周期内只执行一次
export const getPageData = cache(getPageDataInternal);
