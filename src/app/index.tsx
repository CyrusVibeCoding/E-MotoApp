import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { SharingSettings, CompletedRides, type CompletedRide } from '../components/ride-sharing';

const C = { ink: '#151719', muted: '#68727a', line: '#e8eaed', blue: '#bce3fa', pale: '#edf7fd', surface: '#f4f6f7' };
type Tab = 'Today' | 'Friends' | 'Garage' | 'Ranks';
type Post = { id: string; name: string; initials: string; text: string; image?: ImageSourcePropType; miles?: string; likes: number };
const bikePhoto = require('../../assets/photos/bike.jpg');
const ridersPhoto = require('../../assets/photos/riders.jpg');
const initialPosts: Post[] = [
  { id: 'jaden', name: 'Jaden Miller', initials: 'JM', text: 'After-school laps with the crew. Same time tomorrow?', image: ridersPhoto, miles: '12.8 mi · 38 min', likes: 24 },
  { id: 'alex', name: 'Alex Chen', initials: 'AC', text: 'New setup finally coming together. What would you change next?', image: bikePhoto, likes: 41 },
];
const tabs: { label: Tab; icon: SymbolViewProps['name'] }[] = [
  { label: 'Today', icon: 'chart.xyaxis.line' }, { label: 'Friends', icon: 'person.2' },
  { label: 'Garage', icon: 'bicycle' }, { label: 'Ranks', icon: 'trophy' },
];
function Icon({ name, color = C.ink, size = 22 }: { name: SymbolViewProps['name']; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} style={{ width: size, height: size }} />;
}
function Avatar({ initials }: { initials: string }) { return <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>; }
function Section({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button"><Text style={s.action}>{action}</Text></Pressable>}</View>;
}
function Stat({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return <View style={s.stat}><Text style={s.statValue}>{value} <Text style={s.statUnit}>{unit}</Text></Text><Text style={s.small}>{label}</Text></View>;
}
function RoutePreview() {
  return <View style={s.map} accessibilityLabel="Illustrative sample route">
    {[0, 1, 2, 3, 4].map(i => <View key={'v'+i} style={[s.streetVertical, { left: i * 78 + 32 }]} />)}
    {[0, 1, 2].map(i => <View key={'h'+i} style={[s.streetHorizontal, { top: i * 47 + 22 }]} />)}
    <View style={[s.routeLine, { left: 25, top: 110, width: 103 }]} />
    <View style={[s.routeLine, { left: 123, top: 45, width: 5, height: 70 }]} />
    <View style={[s.routeLine, { left: 123, top: 45, width: 142 }]} />
    <View style={[s.routeLine, { left: 260, top: 45, width: 5, height: 47 }]} />
    <View style={[s.locationDot, { left: 253, top: 84 }]} />
    <View style={s.mapLabel}><Text style={s.mapLabelText}>Illustrative route</Text></View>
  </View>;
}
export default function RepRide() {
  const [publicProfile, setPublicProfile] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const [completedRides, setCompletedRides] = useState<CompletedRide[]>([]);
  const sharingProps = { publicProfile, onPublicProfileChange: setPublicProfile, leaderboard, onLeaderboardChange: setLeaderboard, rides: completedRides, onRidesChange: setCompletedRides };
  function finishOrStartRide() {
    if (riding) {
      setCompletedRides(previous => [{ id: Date.now().toString(), date: new Date().toLocaleDateString('en-US'), hidden: false, mapHidden: false }, ...previous]);
    }
    setRiding(!riding);
    setPaused(false);
  }
  const [tab, setTab] = useState<Tab>('Today');
  const [riding, setRiding] = useState(true);
  const [paused, setPaused] = useState(false);
  const [posts, setPosts] = useState(initialPosts);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [mods, setMods] = useState([{ name: 'ProTaper handlebars', category: 'Cockpit' }, { name: 'Warp 9 pegs', category: 'Footpegs' }, { name: 'Shinko 241 tires', category: 'Tires' }]);
  const [month, setMonth] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [composer, setComposer] = useState<'post' | 'mod' | null>(null);
  const [entry, setEntry] = useState('');
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  function openComposer(kind: 'post' | 'mod') { setEntry(''); setComposer(kind); }
  function saveEntry() {
    const text = entry.trim();
    if (!text) return;
    if (composer === 'post') setPosts(p => [{ id: Date.now().toString(), name: 'You', initials: 'CY', text, likes: 0 }, ...p]);
    else setMods(m => [...m, { name: text, category: 'Custom mod' }]);
    setComposer(null);
  }
  const riders = nearby
    ? [['TN', 'Theo Nguyen', '158.6'], ['EB', 'Eli Brooks', '139.2'], ['JM', 'Jaden Miller', '112.8'], ['AC', 'Alex Chen', '94.2'], ['CY', 'You', '86.4']]
    : [['JM', 'Jaden Miller', '112.8'], ['AC', 'Alex Chen', '94.2'], ['CY', 'You', '86.4'], ['RJ', 'Riley James', '71.6'], ['MS', 'Mason Scott', '63.1']];
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.header}><View style={s.brand}><View style={s.mark}><Text style={s.markText}>r</Text></View><Text style={s.brandText}>repride</Text></View><Pressable accessibilityLabel="Your garage" onPress={() => setTab('Garage')}><Avatar initials="CY" /></Pressable></View>
    <ScrollView key={tab} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={s.demo}>INTERACTIVE PREVIEW · SAMPLE DATA</Text>
      {tab === 'Today' && <>
        <View style={s.titleRow}><View><Text style={s.title}>Your day, so far.</Text><Text style={s.small}>{date}</Text></View><View style={s.autoBadge}><View style={s.dot} /><Text style={s.autoText}>Auto-track demo</Text></View></View>
        <View style={s.totalRow}><Text style={s.total}>18.6</Text><Text style={s.totalUnit}>miles</Text></View><Text style={s.subtitle}>A little further, every day.</Text>
        <View style={s.stats}><Stat value="51" unit="min" label="Ride time" /><Stat value="21.9" unit="mph" label="Avg. speed" /><Stat value="2" label="Rides today" /></View>
        <View style={s.rideCard}><View style={s.rideTop}><View style={s.inline}><View style={[s.dot, { backgroundColor: C.blue }]} /><Text style={s.liveText}>{riding ? paused ? 'Demo recording paused' : 'Demo ride detected' : 'Ready for your next ride'}</Text></View>{riding && <Pressable onPress={() => setPaused(!paused)} hitSlop={12} accessibilityLabel={paused ? 'Resume demo recording' : 'Pause demo recording'}><Icon name={paused ? 'play.fill' : 'pause.fill'} color="white" size={17} /></Pressable>}</View>
          {riding ? <><View style={s.rideStats}><View><Text style={s.rideValue}>6.4 <Text style={s.rideUnit}>mi</Text></Text><Text style={s.rideLabel}>THIS RIDE</Text></View><View><Text style={s.rideValue}>{paused ? '0.0' : '18.2'} <Text style={s.rideUnit}>mph</Text></Text><Text style={s.rideLabel}>CURRENT SPEED</Text></View><View><Text style={s.rideValue}>21:08</Text><Text style={s.rideLabel}>RIDE TIME</Text></View></View><RoutePreview /></> : <Text style={s.waiting}>RepRide will detect your rides automatically. Try the sample ride below.</Text>}
          <View style={s.rideFooter}><Text style={s.rideFooterText}>Sur-Ron Light Bee X</Text><Pressable onPress={finishOrStartRide} hitSlop={12}><Text style={s.rideAction}>{riding ? 'Finish demo ride' : 'Simulate a ride'}</Text></Pressable></View>
        </View>
        <CompletedRides {...sharingProps} />
        <Section title="This week" action="86.4 mi total" onPress={() => setTab('Ranks')} />
        <View style={s.bars}>{[38, 57, 30, 65, 76, 4, 4].map((height, i) => <View key={i} style={s.barGroup}><View style={[s.bar, { height, backgroundColor: i === 4 ? C.blue : C.surface }]} /><Text style={s.barLabel}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}</Text></View>)}</View>
        <Section title="From your crew" action="See all" onPress={() => setTab('Friends')} /><Pressable style={s.friendRow} onPress={() => setTab('Friends')}><Avatar initials="JM" /><View style={s.flex}><Text style={s.rowTitle}>Jaden finished a ride</Text><Text style={s.small}>12.8 miles · Sur-Ron Light Bee X</Text></View><Text style={s.small}>12m</Text></Pressable>
      </>}
      {tab === 'Friends' && <>
        <View style={s.titleRow}><View><Text style={s.title}>Your people.</Text><Text style={s.small}>Rides, builds, and everything between.</Text></View><Pressable style={s.addButton} onPress={() => openComposer('post')} accessibilityLabel="Create a post"><Icon name="plus" size={20} /></Pressable></View>
        <CompletedRides {...sharingProps} />
        {posts.map(post => <View style={s.post} key={post.id}><View style={s.postHeader}><Avatar initials={post.initials} /><View><Text style={s.rowTitle}>{post.name}</Text><Text style={s.small}>Sur-Ron Light Bee X · Demo post</Text></View></View>{post.image && <Image source={post.image} style={s.postImage} accessibilityLabel="Electric bike riding photo" />}<View style={s.postActions}><Pressable accessibilityRole="button" accessibilityLabel={liked[post.id] ? 'Unlike post' : 'Like post'} accessibilityState={{ selected: !!liked[post.id] }} style={s.inline} onPress={() => setLiked(l => ({ ...l, [post.id]: !l[post.id] }))}><Icon name={liked[post.id] ? 'heart.fill' : 'heart'} color={liked[post.id] ? '#38799f' : C.ink} size={21} /><Text style={s.body}>{post.likes + (liked[post.id] ? 1 : 0)}</Text></Pressable></View><Text style={s.body}>{post.text}</Text>{post.miles && <View style={s.rideChip}><Text style={s.chipText}>{post.miles}</Text><Text style={s.small}>Sample ride</Text></View>}</View>)}
        <Text style={s.footnote}>Photo and video posting will be connected in a later build. Text posts work in this preview session.</Text>
      </>}
      {tab === 'Garage' && <>
        <SharingSettings {...sharingProps} />
        <Text style={s.title}>Your garage.</Text><Text style={s.small}>Cyrus · @cyrus.rides</Text><Image source={bikePhoto} style={s.bikePhoto} accessibilityLabel="Placeholder Sur-Ron electric bike" /><Text style={s.bikeTitle}>Sur-Ron Light Bee X</Text><Text style={s.small}>The daily driver. Always a work in progress.</Text><View style={s.specRow}><View style={s.tag}><Text style={s.chipText}>Electric</Text></View><View style={s.tag}><Text style={s.chipText}>Sample build</Text></View></View><View style={s.stats}><Stat value="428" unit="mi" label="Total miles" /><Stat value="32" label="Rides logged" /><Stat value={String(mods.length)} label="Mods" /></View><Section title="The setup" action="+ Add mod" onPress={() => openComposer('mod')} />{mods.map((mod, i) => <View key={i} style={s.modRow}><View style={s.modIcon}><Icon name="wrench" size={18} /></View><View style={s.flex}><Text style={s.rowTitle}>{mod.name}</Text><Text style={s.small}>{mod.category}</Text></View></View>)}
      </>}
      {tab === 'Ranks' && <>
        {!leaderboard && <View style={s.rideChip}><Text style={s.small}>You have not joined leaderboards.</Text><Pressable onPress={() => setLeaderboard(true)}><Text style={s.action}>Join</Text></Pressable></View>}
        <Text style={s.title}>A little friendly rivalry.</Text><Text style={s.small}>Miles ridden · Sample rankings</Text><View style={s.segments}>{['Friends', 'Nearby'].map((label, i) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: nearby === !!i }} style={[s.segment, nearby === !!i && s.selected]} onPress={() => setNearby(!!i)}><Text style={s.chipText}>{label}</Text></Pressable>)}</View><View style={s.rankHero}><View><Text style={s.rankCaption}>Your {month ? 'month' : 'week'} in miles</Text><Text style={s.rankMiles}>{(86.4 * (month ? 3.6 : 1)).toFixed(1)}</Text><Text style={s.rankCaption}>Keep your crew in sight.</Text></View><View><Text style={s.rankPosition}>{leaderboard ? (nearby ? '#5' : '#3') : '—'}</Text><Text style={s.rankCaption}>{nearby ? 'nearby' : 'friends'}</Text></View></View><Section title="Distance leaderboard" action={month ? 'This month' : 'This week'} onPress={() => setMonth(!month)} />{riders.filter(rider => leaderboard || rider[1] !== 'You').map((rider, i) => <View key={rider[0]} style={[s.rankRow, rider[1] === 'You' && s.myRank]}><Text style={s.position}>{i + 1}</Text><Avatar initials={rider[0]} /><Text style={[s.rowTitle, s.flex]}>{rider[1]}</Text><Text style={s.rowTitle}>{(Number(rider[2]) * (month ? 3.6 : 1)).toFixed(1)} <Text style={s.small}>mi</Text></Text></View>)}<Text style={s.footnote}>Illustrative rankings. Real ride verification and friend connections are still being built.</Text>
      </>}
    </ScrollView>
    <View style={s.nav}>{tabs.map(item => <Pressable key={item.label} onPress={() => setTab(item.label)} style={s.navButton} accessibilityRole="tab" accessibilityState={{ selected: tab === item.label }} accessibilityLabel={item.label}><View style={[s.navIcon, tab === item.label && s.navSelected]}><Icon name={item.icon} color={tab === item.label ? C.ink : C.muted} size={22} /></View><Text style={[s.navLabel, tab === item.label && { color: C.ink }]}>{item.label}</Text></Pressable>)}</View>
    <Modal visible={composer !== null} transparent animationType="slide" onRequestClose={() => setComposer(null)}><KeyboardAvoidingView style={s.modalBackdrop} behavior="padding"><SafeAreaView edges={['bottom']} style={s.modal}><View style={s.titleRow}><Text style={s.sectionTitle}>{composer === 'mod' ? 'Add to your setup' : 'Share with your crew'}</Text><Pressable hitSlop={12} onPress={() => setComposer(null)} accessibilityLabel="Close"><Icon name="xmark" /></Pressable></View><TextInput style={s.input} accessibilityLabel={composer === 'mod' ? 'Modification name' : 'Post text'} value={entry} onChangeText={setEntry} multiline autoFocus maxLength={500} placeholder={composer === 'mod' ? 'e.g. New handlebars' : 'What have you been up to?'} placeholderTextColor={C.muted} /><Pressable disabled={!entry.trim()} style={[s.saveButton, !entry.trim() && { opacity: 0.4 }]} onPress={saveEntry}><Text style={s.saveText}>{composer === 'mod' ? 'Add mod' : 'Share post'}</Text></Pressable><Text style={s.footnote}>Demo changes last until the app reloads.</Text></SafeAreaView></KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'white' }, flex: { flex: 1 },
  header: { paddingHorizontal: 23, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', gap: 7, alignItems: 'center' }, mark: { width: 25, height: 25, backgroundColor: C.ink, borderRadius: 7, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }, markText: { color: C.blue, fontFamily: 'BarlowCondensed', fontSize: 26, lineHeight: 29 }, brandText: { fontFamily: 'DMSansBold', fontSize: 27, letterSpacing: -1 },
  avatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#e3edf3', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontFamily: 'DMSansBold', fontSize: 11, color: C.ink }, content: { paddingHorizontal: 23, paddingBottom: 25 },
  demo: { fontFamily: 'DMSansMedium', fontSize: 9, color: C.muted, letterSpacing: 1.1, marginTop: 3, marginBottom: 15 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 16 }, title: { fontFamily: 'BarlowCondensed', fontSize: 33, color: C.ink, marginBottom: 4, flexShrink: 1 }, small: { fontFamily: 'DMSans', fontSize: 11, lineHeight: 17, color: C.muted },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: C.pale, borderRadius: 20 }, autoText: { fontFamily: 'DMSansMedium', fontSize: 9, color: '#285772' }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#285772' }, totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, total: { fontFamily: 'BarlowCondensed', fontSize: 92, lineHeight: 99, color: C.ink, letterSpacing: -3 }, totalUnit: { fontFamily: 'DMSans', fontSize: 16, color: C.muted }, subtitle: { fontFamily: 'DMSans', fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 24 },
  stats: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 21, marginBottom: 20 }, stat: { flex: 1 }, statValue: { fontFamily: 'DMSansMedium', fontSize: 21, color: C.ink, marginBottom: 5 }, statUnit: { fontFamily: 'DMSans', fontSize: 10, color: C.muted },
  rideCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: C.ink }, rideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 17 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 7 }, liveText: { fontFamily: 'DMSansMedium', fontSize: 11, color: '#e0e7eb' }, rideStats: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 17, paddingBottom: 17 }, rideValue: { fontFamily: 'BarlowCondensed', fontSize: 33, color: 'white' }, rideUnit: { fontFamily: 'DMSans', fontSize: 10, color: '#b9c2c8' }, rideLabel: { fontFamily: 'DMSans', fontSize: 8, color: '#b9c2c8', marginTop: 5 }, rideFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 }, rideFooterText: { fontFamily: 'DMSans', fontSize: 10, color: '#b9c2c8' }, rideAction: { fontFamily: 'DMSansMedium', fontSize: 10, color: C.blue }, waiting: { color: '#cdd5db', fontFamily: 'DMSans', fontSize: 12, lineHeight: 21, paddingHorizontal: 17, paddingBottom: 15 },
  map: { height: 143, backgroundColor: '#e6ecef', overflow: 'hidden' }, streetVertical: { position: 'absolute', width: 10, height: 150, backgroundColor: '#f9fbfc' }, streetHorizontal: { position: 'absolute', left: 0, right: 0, height: 9, backgroundColor: '#f9fbfc' }, routeLine: { position: 'absolute', height: 5, backgroundColor: '#609ec2', borderRadius: 3 }, locationDot: { position: 'absolute', width: 19, height: 19, borderRadius: 10, backgroundColor: C.ink, borderWidth: 4, borderColor: C.blue }, mapLabel: { position: 'absolute', right: 9, bottom: 9, paddingVertical: 4, paddingHorizontal: 7, backgroundColor: '#ffffffeb', borderRadius: 4 }, mapLabelText: { fontFamily: 'DMSans', fontSize: 9, color: C.muted },
  section: { marginTop: 24, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, sectionTitle: { fontFamily: 'DMSansBold', fontSize: 16, color: C.ink }, action: { fontFamily: 'DMSans', fontSize: 11, color: C.muted }, bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 108 }, barGroup: { flex: 1, alignItems: 'center', gap: 9 }, bar: { width: '100%', borderRadius: 5 }, barLabel: { fontFamily: 'DMSans', fontSize: 10, color: C.muted }, friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }, rowTitle: { fontFamily: 'DMSansMedium', fontSize: 12, lineHeight: 19, color: C.ink },
  nav: { flexDirection: 'row', paddingTop: 12, paddingBottom: 7, borderTopWidth: 1, borderTopColor: C.line }, navButton: { flex: 1, alignItems: 'center', gap: 5, minHeight: 51 }, navIcon: { paddingVertical: 5, paddingHorizontal: 18, borderRadius: 12 }, navSelected: { backgroundColor: C.blue }, navLabel: { fontFamily: 'DMSansMedium', fontSize: 10, color: C.muted },
  addButton: { backgroundColor: C.blue, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, post: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.line }, postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }, postImage: { width: '100%', height: 245, borderRadius: 15 }, postActions: { paddingTop: 14, paddingBottom: 9 }, body: { fontFamily: 'DMSans', fontSize: 13, lineHeight: 22, color: C.ink }, rideChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 7, backgroundColor: C.surface, marginTop: 12 }, chipText: { fontFamily: 'DMSansMedium', fontSize: 11, color: C.ink }, footnote: { fontFamily: 'DMSans', fontSize: 11, lineHeight: 18, color: C.muted, marginTop: 20 },
  bikePhoto: { width: '100%', height: 230, borderRadius: 16, marginTop: 23, marginBottom: 18 }, bikeTitle: { fontFamily: 'BarlowCondensed', fontSize: 32, color: C.ink, marginBottom: 5 }, specRow: { flexDirection: 'row', gap: 8, marginTop: 15, marginBottom: 25 }, tag: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 7 }, modRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 17 }, modIcon: { padding: 10, borderRadius: 10, backgroundColor: C.surface },
  segments: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: C.surface, borderRadius: 12, marginTop: 22, marginBottom: 22 }, segment: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 9 }, selected: { backgroundColor: 'white' }, rankHero: { backgroundColor: C.blue, borderRadius: 16, padding: 21, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rankCaption: { fontFamily: 'DMSans', fontSize: 11, color: '#34576d' }, rankMiles: { fontFamily: 'BarlowCondensed', fontSize: 55, color: C.ink, marginVertical: 3 }, rankPosition: { fontFamily: 'BarlowCondensed', fontSize: 44, color: C.ink }, rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.line }, position: { fontFamily: 'DMSans', width: 14, fontSize: 12, color: C.muted }, myRank: { backgroundColor: C.pale, borderRadius: 12, borderBottomWidth: 0 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }, modal: { padding: 25, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24 }, input: { minHeight: 110, textAlignVertical: 'top', backgroundColor: C.surface, borderRadius: 12, padding: 15, color: C.ink, fontFamily: 'DMSans', fontSize: 16 }, saveButton: { backgroundColor: C.ink, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 17 }, saveText: { fontFamily: 'DMSansBold', fontSize: 13, color: 'white' },
});
