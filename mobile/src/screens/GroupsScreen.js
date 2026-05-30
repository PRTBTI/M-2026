import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors, spacing, radius } from '../theme';

function GroupCard({ groupCode, C, accent }) {
  const { getGroupStandings } = useApp();
  const rows = getGroupStandings(groupCode);

  return (
    <View style={[s.card, { backgroundColor: C.surface, borderColor: C.line }]}>
      <View style={[s.cardHeader, { backgroundColor: '#242321' }]}>
        <Text style={s.cardTitle}>Grupa {groupCode}</Text>
        <Text style={s.cardCount}>{rows.length} drużyny</Text>
      </View>
      {/* Column headers */}
      <View style={[s.row, s.headerRow, { borderBottomColor: C.line }]}>
        <Text style={[s.cell, s.cellSlot, s.colHead, { color: C.muted }]}>Kod</Text>
        <Text style={[s.cell, s.cellTeam, s.colHead, { color: C.muted }]}>Drużyna</Text>
        <Text style={[s.cell, s.cellNum, s.colHead, { color: C.muted }]}>M</Text>
        <Text style={[s.cell, s.cellNum, s.colHead, { color: C.muted }]}>PKT</Text>
        <Text style={[s.cell, s.cellNum, s.colHead, { color: C.muted }]}>RB</Text>
        <Text style={[s.cell, s.cellGoals, s.colHead, { color: C.muted }]}>Br</Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.team}
          style={[
            s.row,
            i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.line },
          ]}
        >
          <Text style={[s.cell, s.cellSlot, { color: C.muted }]}>{row.slot}</Text>
          <Text style={[s.cell, s.cellTeam, { color: C.ink }]} numberOfLines={1}>{row.team}</Text>
          <Text style={[s.cell, s.cellNum, { color: C.ink }]}>{row.played}</Text>
          <Text style={[s.cell, s.cellNum, s.bold, { color: C.ink }]}>{row.pts}</Text>
          <Text style={[s.cell, s.cellNum, { color: C.muted }]}>{row.gd > 0 ? `+${row.gd}` : row.gd}</Text>
          <Text style={[s.cell, s.cellGoals, { color: C.muted }]}>{row.gf}:{row.ga}</Text>
        </View>
      ))}
    </View>
  );
}

export default function GroupsScreen() {
  const { data, getCurrentTheme, getAccentColor } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();

  const groups = useMemo(() => Object.keys(data.groups), [data.groups]);

  return (
    <FlatList
      data={groups}
      keyExtractor={g => g}
      numColumns={1}
      renderItem={({ item }) => <GroupCard groupCode={item} C={C} accent={accent} />}
      contentContainerStyle={[ls.list, { backgroundColor: C.paper }]}
      style={{ backgroundColor: C.paper }}
      showsVerticalScrollIndicator={false}
    />
  );
}

const ls = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
});

const s = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: 0 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
  cardCount: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 10 },
  headerRow: { borderBottomWidth: 1, paddingVertical: 7 },
  colHead: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  bold: { fontWeight: '800' },
  cell: { fontSize: 13, fontWeight: '700' },
  cellSlot: { width: 36 },
  cellTeam: { flex: 1 },
  cellNum: { width: 36, textAlign: 'center' },
  cellGoals: { width: 52, textAlign: 'right' },
});
