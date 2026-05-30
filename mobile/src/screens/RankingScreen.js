import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { darkColors, lightColors, spacing, radius } from '../theme';

export default function RankingScreen() {
  const { getRanking, getCurrentTheme, getAccentColor } = useApp();
  const theme = getCurrentTheme();
  const C = theme === 'dark' ? darkColors : lightColors;
  const accent = getAccentColor();

  const rows = useMemo(() => getRanking(), [getRanking]);

  function renderRow({ item, index }) {
    const isFirst = index === 0;
    return (
      <View style={[
        s.row,
        { backgroundColor: isFirst ? `${accent}18` : C.surface, borderColor: C.line },
        isFirst && { borderColor: accent },
      ]}>
        <View style={[s.posBadge, isFirst && { backgroundColor: accent }]}>
          <Text style={[s.posText, isFirst && { color: '#fff' }]}>{index + 1}</Text>
        </View>
        <Text style={[s.name, { color: C.ink }]} numberOfLines={1}>{item.player}</Text>
        <View style={s.stats}>
          <StatCell label="PKT" value={item.total} big C={C} accent={accent} active={isFirst} />
          <StatCell label="Dokł" value={item.exact} C={C} accent={accent} active={isFirst} />
          <StatCell label="Znaki" value={item.signs} C={C} accent={accent} active={isFirst} />
          <StatCell label="Typy" value={item.typed} C={C} accent={accent} active={isFirst} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={r => r.player}
      renderItem={renderRow}
      contentContainerStyle={[ls.list, { backgroundColor: C.paper }]}
      style={{ backgroundColor: C.paper }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={[s.tableHead, { borderBottomColor: C.line }]}>
          <View style={s.posBadge} />
          <Text style={[s.headName, { color: C.muted }]}>Typer</Text>
          <View style={s.stats}>
            {['PKT', 'Dokł', 'Znaki', 'Typy'].map(l => (
              <Text key={l} style={[s.headCell, { color: C.muted }]}>{l}</Text>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={[ls.empty, { color: C.muted }]}>Brak typerów. Dodaj gracza w zakładce Typowanie.</Text>
      }
    />
  );
}

function StatCell({ label, value, big, C, accent, active }) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statValue, big && s.statValueBig, active ? { color: accent } : { color: C.ink }]}>
        {value}
      </Text>
    </View>
  );
}

const ls = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xl, fontSize: 14, fontWeight: '700' },
});

const s = StyleSheet.create({
  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, marginBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headName: { flex: 1, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  headCell: { width: 46, textAlign: 'center', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, marginBottom: spacing.sm,
  },
  posBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  posText: { fontSize: 14, fontWeight: '800', color: '#bdb4a8' },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  stats: { flexDirection: 'row' },
  statCell: { width: 46, alignItems: 'center' },
  statValue: { fontSize: 13, fontWeight: '700' },
  statValueBig: { fontSize: 16, fontWeight: '800' },
});
