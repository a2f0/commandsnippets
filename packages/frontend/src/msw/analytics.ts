import type {AnalyticsParams} from '@commandsnippets/api-shared/requests';
import type {
  AnalyticsDocument,
  Tag,
  TagTextEntry,
  TextEntry,
  TextEntryReused,
} from '@commandsnippets/api-shared/responses';

/** Stateful browser fixture for the aggregate API; production aggregates in D1. */
export function mockAnalytics(
  params: AnalyticsParams,
  version: number,
  allTags: Tag[],
  allEntries: TextEntry[],
  allLinks: TagTextEntry[],
  reuses: TextEntryReused[]
): AnalyticsDocument {
  const tags = allTags.filter(row => !row.attributes.is_deleted);
  const entries = allEntries.filter(row => !row.attributes.is_deleted);
  const links = allLinks.filter(
    row =>
      !row.attributes.is_deleted &&
      tags.some(tag => tag.id === row.relationships.tag.data.id) &&
      entries.some(entry => entry.id === row.relationships.text_entry.data.id)
  );
  type Event = {date: string; entry?: string; tag?: string};
  const sources: Record<AnalyticsParams['activity'], Event[]> = {
    created: entries.map(row => ({
      date: row.attributes.date_created,
      entry: row.id,
    })),
    tags_created: tags.map(row => ({
      date: row.attributes.date_created,
      tag: row.id,
    })),
    tagged: links.map(row => ({
      date: row.attributes.date_created,
      entry: row.relationships.text_entry.data.id,
      tag: row.relationships.tag.data.id,
    })),
    reused: reuses
      .filter(row =>
        entries.some(entry => entry.id === row.relationships.text_entry.data.id)
      )
      .map(row => ({
        date: row.attributes.date_created,
        entry: row.relationships.text_entry.data.id,
      })),
  };
  const events = sources[params.activity].filter(
    row =>
      row.date.slice(0, 10) >= params.from &&
      row.date.slice(0, 10) <= params.to &&
      (!params.tag ||
        (row.tag
          ? row.tag === params.tag
          : links.some(
              link =>
                link.relationships.tag.data.id === params.tag &&
                link.relationships.text_entry.data.id === row.entry
            )))
  );
  const tagCounts = new Map<string, number>();
  const entryCounts = new Map<string, number>();
  const timeline = new Map<string, number>();
  const count = (map: Map<string, number>, key: string) =>
    map.set(key, (map.get(key) ?? 0) + 1);
  for (const event of events) {
    if (event.entry) count(entryCounts, event.entry);
    const tagIds = event.tag
      ? [event.tag]
      : links
          .filter(link => link.relationships.text_entry.data.id === event.entry)
          .map(link => link.relationships.tag.data.id);
    for (const id of tagIds) count(tagCounts, id);
    const date = new Date(`${event.date.slice(0, 10)}T00:00:00Z`);
    if (params.interval === 'month') date.setUTCDate(1);
    if (params.interval === 'week')
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    count(timeline, date.toISOString().slice(0, 10));
  }
  const ranked = (counts: Map<string, number>, names: Map<string, string>) =>
    [...counts]
      .map(([id, count]) => ({id, name: names.get(id) ?? id, count}))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
          Number(a.id) - Number(b.id)
      )
      .slice(0, 10);
  return {
    data: {
      version,
      activity: params.activity,
      interval: params.interval,
      from: params.from,
      to: params.to,
      total: events.length,
      entries: entryCounts.size,
      tags: tagCounts.size,
      timeline: [...timeline]
        .map(([date, count]) => ({date, count}))
        .sort((a, b) => a.date.localeCompare(b.date)),
      top_tags: ranked(
        tagCounts,
        new Map(tags.map(tag => [tag.id, tag.attributes.name]))
      ),
      top_entries: ranked(
        entryCounts,
        new Map(entries.map(entry => [entry.id, entry.attributes.subject]))
      ),
    },
  };
}
