// Quizfragen. Aufbau: [Kategorie, Frage, [RICHTIGE Antwort, falsch, falsch, falsch], Wissens-Info]
// Die richtige Antwort steht hier immer zuerst – der Server mischt die Antworten vor dem Senden.
export const CATEGORIES = {
  mix: { name: 'Alles gemischt', icon: '🎖️' },
  panzer: { name: 'Panzer & Fahrzeuge', icon: '🛡️' },
  luft: { name: 'Luftwaffe & Flugzeuge', icon: '✈️' },
  see: { name: 'Marine & Schiffe', icon: '⚓' },
  raenge: { name: 'Ränge & Truppe', icon: '⭐' },
  geschichte: { name: 'Geschichte', icon: '📜' },
  wissen: { name: 'Funk, Ausrüstung & Wissen', icon: '📡' },
};

const RAW = [
  // ---------- Panzer & Fahrzeuge ----------
  ['panzer', 'Wie heißt der Kampfpanzer der Bundeswehr?', ['Leopard 2', 'Tiger 3', 'Puma 2', 'Luchs 1'], 'Der Leopard 2 ist seit 1979 bei der Bundeswehr im Einsatz und wird in viele Länder exportiert.'],
  ['panzer', 'Aus welchem Land stammt der Kampfpanzer M1 Abrams?', ['USA', 'Großbritannien', 'Frankreich', 'Israel'], 'Der Abrams hat eine Gasturbine als Antrieb – ähnlich wie ein Flugzeugtriebwerk.'],
  ['panzer', 'Aus welchem Land stammt der Kampfpanzer Leclerc?', ['Frankreich', 'Italien', 'Spanien', 'Polen'], 'Der Leclerc hat einen Ladeautomaten und braucht deshalb nur 3 Mann Besatzung.'],
  ['panzer', 'Aus welchem Land stammt der Kampfpanzer Challenger 2?', ['Großbritannien', 'Kanada', 'Australien', 'USA'], null],
  ['panzer', 'Aus welchem Land stammt der Kampfpanzer Merkava?', ['Israel', 'Türkei', 'Ägypten', 'Indien'], 'Beim Merkava sitzt der Motor vorne – das schützt die Besatzung zusätzlich.'],
  ['panzer', 'Warum haben viele Panzer Ketten statt Räder?', ['Damit sie im Gelände nicht einsinken', 'Damit sie auf der Autobahn schneller sind', 'Weil Ketten billiger sind', 'Damit sie leiser fahren'], 'Ketten verteilen das große Gewicht auf eine große Fläche.'],
  ['panzer', 'Wie heißt der drehbare Aufbau eines Panzers, in dem die Kanone sitzt?', ['Turm', 'Wanne', 'Kuppel', 'Schürze'], null],
  ['panzer', 'Wie heißt der untere Teil (der Rumpf) eines Panzers?', ['Wanne', 'Turm', 'Kette', 'Lafette'], 'In der Wanne sitzen Motor, Fahrer und das Laufwerk.'],
  ['panzer', 'Wie viele Soldaten gehören zur Besatzung eines Leopard 2?', ['4', '2', '6', '8'], 'Kommandant, Richtschütze, Ladeschütze und Fahrer.'],
  ['panzer', 'Welches Kaliber hat die Kanone des Leopard 2?', ['120 mm', '20 mm', '50 mm', '300 mm'], null],
  ['panzer', 'Ungefähr wie viel PS hat der Motor eines Leopard 2?', ['1.500 PS', '150 PS', '15.000 PS', '50 PS'], null],
  ['panzer', 'Wie schwer ist ein Leopard 2A6 ungefähr?', ['etwa 60 Tonnen', 'etwa 6 Tonnen', 'etwa 600 Tonnen', 'etwa 1 Tonne'], 'So viel wie ungefähr 40 Autos zusammen.'],
  ['panzer', 'Welcher Panzer hat keinen Ladeschützen, weil ein Automat die Kanone lädt?', ['Leclerc', 'Leopard 2', 'M1 Abrams', 'Challenger 2'], null],
  ['panzer', 'Wie viele Soldaten kann der Schützenpanzer Puma hinten mitnehmen?', ['6', '2', '12', '20'], 'Dazu kommen 3 Mann Besatzung.'],
  ['panzer', 'Wie heißt der Radpanzer der Bundeswehr mit austauschbaren Missions-Modulen?', ['Boxer', 'Fuchs', 'Wiesel', 'Dingo'], 'Das hintere Modul kann z. B. ein Sanitätsraum oder ein Truppentransport sein.'],
  ['panzer', 'Was ist der Wiesel?', ['Ein sehr kleiner Panzer, der mit Hubschraubern transportiert werden kann', 'Ein Hubschrauber', 'Ein U-Boot', 'Ein Lastwagen'], null],
  ['panzer', 'Was macht ein Bergepanzer?', ['Er schleppt liegengebliebene Fahrzeuge ab', 'Er fährt nur in den Bergen', 'Er schießt auf Flugzeuge', 'Er baut Häuser'], null],
  ['panzer', 'Wie heißt die Panzerschnellbrücke der Bundeswehr auf Basis des Leopard 2?', ['Leguan', 'Wiesel', 'Fennek', 'Mungo'], 'Der Leguan kann eine Brücke von über 20 Metern in wenigen Minuten verlegen.'],
  ['panzer', 'Was ist die Panzerhaubitze 2000?', ['Ein Artilleriegeschütz auf Ketten', 'Ein Flugabwehrpanzer', 'Ein Kampfjet', 'Ein Minenräumboot'], 'Sie schießt mit Kaliber 155 mm über 30 Kilometer weit.'],
  ['panzer', 'Wie heißt der berühmte sowjetische Panzer aus dem Zweiten Weltkrieg?', ['T-34', 'M4 Sherman', 'Centurion', 'Leopard 1'], 'Vom T-34 wurden mehr als 50.000 Stück gebaut.'],
  ['panzer', 'In welchem Krieg wurden Panzer zum ersten Mal eingesetzt?', ['Erster Weltkrieg', 'Zweiter Weltkrieg', 'Dreißigjähriger Krieg', 'Vietnamkrieg'], 'Britische Panzer vom Typ Mark I fuhren 1916 zum ersten Mal.'],
  ['panzer', 'Welchen Spitznamen hatte der amerikanische Panzer M4 aus dem Zweiten Weltkrieg?', ['Sherman', 'Patton', 'Bradley', 'Abrams'], null],
  ['panzer', 'Was ist der Fennek?', ['Ein Spähwagen zur Aufklärung', 'Ein Kampfpanzer', 'Ein Hubschrauber', 'Ein Schnellboot'], 'Der Fennek ist nach einem Wüstenfuchs benannt – klein, flink und mit großen „Ohren“ (Sensoren).'],
  ['panzer', 'Welcher Panzer der Bundeswehr war ein Flugabwehrkanonenpanzer?', ['Gepard', 'Luchs', 'Marder', 'Fuchs'], 'Der Gepard hat zwei 35-mm-Kanonen und ein eigenes Radar.'],
  ['panzer', 'Was ist der Marder?', ['Ein Schützenpanzer', 'Ein U-Boot', 'Ein Kampfjet', 'Eine Rakete'], 'Der Marder wird bei der Bundeswehr nach und nach durch den Puma ersetzt.'],
  ['panzer', 'Welcher Kampfpanzer war der Vorgänger des Leopard 2 bei der Bundeswehr?', ['Leopard 1', 'Tiger II', 'T-72', 'Centurion'], null],
  ['panzer', 'Wofür steht die Abkürzung MBT bei Panzern?', ['Main Battle Tank (Kampfpanzer)', 'Mobile Brücken-Transporter', 'Militär-Bus-Taxi', 'Maschinen-Bau-Technik'], null],
  ['panzer', 'Was ist der Dingo?', ['Ein geschütztes Fahrzeug für Patrouillen', 'Ein Hund der Bundeswehr', 'Ein Kampfhubschrauber', 'Ein Torpedo'], null],

  // ---------- Luftwaffe & Flugzeuge ----------
  ['luft', 'Welches Kampfflugzeug fliegt die Luftwaffe, das Deutschland zusammen mit Großbritannien, Italien und Spanien gebaut hat?', ['Eurofighter Typhoon', 'F-14 Tomcat', 'Mirage 2000', 'Gripen'], null],
  ['luft', 'Welches Tarnkappen-Kampfflugzeug hat Deutschland bestellt?', ['F-35', 'F-117', 'SR-71', 'B-2'], 'Die F-35 kommt aus den USA und ist auf dem Radar sehr schwer zu entdecken.'],
  ['luft', 'Was bedeutet „Tarnkappe“ (Stealth) bei einem Flugzeug?', ['Es ist auf dem Radar schwer zu sehen', 'Es ist für die Augen unsichtbar', 'Es ist besonders laut', 'Es kann tauchen'], null],
  ['luft', 'Was gibt die Mach-Zahl an?', ['Geschwindigkeit im Vergleich zur Schallgeschwindigkeit', 'Die Flughöhe', 'Den Treibstoff im Tank', 'Das Gewicht'], 'Mach 1 ist Schallgeschwindigkeit – ungefähr 1.200 km/h am Boden.'],
  ['luft', 'Wie schnell kann der Eurofighter ungefähr fliegen?', ['Mach 2 (doppelte Schallgeschwindigkeit)', '300 km/h', '800 km/h', '10.000 km/h'], null],
  ['luft', 'Wie heißt der große Transporthubschrauber mit zwei Rotoren (vorne und hinten)?', ['CH-47 Chinook', 'Tiger', 'Apache', 'NH90'], 'Die Bundeswehr hat den Chinook bestellt.'],
  ['luft', 'Wie heißt der Kampfhubschrauber der Bundeswehr?', ['Tiger', 'Apache', 'Cobra', 'Lynx'], 'Der Tiger wurde von Deutschland und Frankreich gemeinsam entwickelt.'],
  ['luft', 'Was ist der Airbus A400M?', ['Ein Transportflugzeug', 'Ein Jagdflugzeug', 'Ein Hubschrauber', 'Eine Drohne'], 'Die A400M hat vier große Propeller-Triebwerke und kann sogar Hubschrauber transportieren.'],
  ['luft', 'Was ist eine Drohne?', ['Ein Luftfahrzeug ohne Pilot an Bord', 'Ein Fallschirm', 'Ein Flugzeugträger', 'Eine Radarstation'], null],
  ['luft', 'Wie heißt die Kunstflugstaffel der US Navy?', ['Blue Angels', 'Red Arrows', 'Frecce Tricolori', 'Patrouille de France'], null],
  ['luft', 'Aus welchem Land kommt die Kunstflugstaffel „Red Arrows“?', ['Großbritannien', 'Italien', 'USA', 'Frankreich'], null],
  ['luft', 'Welches Flugzeug ist das schnellste je gebaute Flugzeug mit Düsentriebwerken und Piloten?', ['SR-71 Blackbird', 'Concorde', 'Boeing 747', 'Spitfire'], 'Die SR-71 flog über dreimal so schnell wie der Schall.'],
  ['luft', 'Wie hieß der erste einsatzfähige Düsenjäger der Welt?', ['Messerschmitt Me 262', 'Spitfire', 'F-16', 'P-51 Mustang'], 'Die Me 262 flog im Zweiten Weltkrieg.'],
  ['luft', 'Was ist ein AWACS-Flugzeug?', ['Eine fliegende Radar- und Frühwarnstation', 'Ein Tankflugzeug', 'Ein Löschflugzeug', 'Ein Segelflugzeug'], 'Man erkennt es an der großen, runden Radarscheibe auf dem Rücken.'],
  ['luft', 'Welchen Namen hat die F-16?', ['Fighting Falcon', 'Raptor', 'Hornet', 'Eagle'], null],
  ['luft', 'Welchen Namen hat die F-22?', ['Raptor', 'Tomcat', 'Phantom', 'Harrier'], null],
  ['luft', 'Welches britische Kampfflugzeug konnte senkrecht starten und landen?', ['Harrier', 'Tornado', 'Typhoon', 'Hercules'], null],
  ['luft', 'Was ist das Besondere an den Flügeln des Tornado?', ['Es sind Schwenkflügel, die man im Flug verstellen kann', 'Sie sind aus Holz', 'Er hat gar keine Flügel', 'Sie können flattern'], null],
  ['luft', 'Was macht ein Tankflugzeug?', ['Es betankt andere Flugzeuge in der Luft', 'Es löscht Waldbrände', 'Es transportiert nur Panzer', 'Es zieht Werbebanner'], null],
  ['luft', 'Wofür ist ein Schleudersitz da?', ['Damit sich Piloten im Notfall retten können', 'Zum Laden der Kanone', 'Für Passagiere', 'Zum Abwerfen von Post'], null],
  ['luft', 'Welchen Namen hat das Transportflugzeug C-130?', ['Hercules', 'Galaxy', 'Atlas', 'Globemaster'], 'Die C-130 Hercules fliegt seit den 1950er-Jahren und wird immer noch gebaut.'],
  ['luft', 'Wie nennt man eine kleine Einheit von Flugzeugen bei der Luftwaffe?', ['Staffel', 'Kompanie', 'Flotte', 'Herde'], 'Mehrere Staffeln bilden ein Geschwader.'],
  ['luft', 'Was zeigt der Höhenmesser im Cockpit an?', ['Die Flughöhe', 'Die Uhrzeit', 'Den Treibstoff', 'Die Temperatur'], null],
  ['luft', 'Was ist ein Hangar?', ['Eine große Halle für Flugzeuge', 'Ein Flugzeugteil', 'Ein Fallschirm', 'Ein Funkgerät'], null],
  ['luft', 'Wie heißt der Verband der Luftwaffe, der Regierungsmitglieder fliegt?', ['Flugbereitschaft', 'Blue Angels', 'Kampfstaffel', 'Lufthansa'], 'Die Flugbereitschaft fliegt z. B. Kanzler und Minister.'],
  ['luft', 'Welches Kampfflugzeug wird bei der Luftwaffe durch die F-35 ersetzt?', ['Tornado', 'Spitfire', 'Concorde', 'Hercules'], null],

  // ---------- Marine & Schiffe ----------
  ['see', 'Wie nennt man die Seestreitkräfte eines Landes?', ['Marine', 'Infanterie', 'Artillerie', 'Kavallerie'], null],
  ['see', 'Wie heißt der vordere Teil eines Schiffes?', ['Bug', 'Heck', 'Kiel', 'Mast'], null],
  ['see', 'Wie heißt der hintere Teil eines Schiffes?', ['Heck', 'Bug', 'Deck', 'Brücke'], null],
  ['see', 'Welche Seite ist auf einem Schiff „Backbord“ (in Fahrtrichtung)?', ['Links', 'Rechts', 'Vorne', 'Hinten'], 'Merkspruch: Backbord hat genau wie „links“ ein k im Wort.'],
  ['see', 'Welche Seite ist auf einem Schiff „Steuerbord“ (in Fahrtrichtung)?', ['Rechts', 'Links', 'Oben', 'Unten'], null],
  ['see', 'Wie nennt man die Küche auf einem Schiff?', ['Kombüse', 'Kajüte', 'Brücke', 'Bilge'], null],
  ['see', 'Von wo aus wird ein großes Schiff gesteuert?', ['Von der Brücke', 'Aus der Kombüse', 'Vom Anker', 'Aus dem Laderaum'], null],
  ['see', 'Wie nennt man den Raum, in dem die Besatzung gemeinsam isst?', ['Messe', 'Brücke', 'Bug', 'Ruder'], null],
  ['see', 'Was ist ein Periskop?', ['Das Sehrohr eines U-Boots', 'Ein Funkgerät', 'Ein Torpedo', 'Ein Anker'], null],
  ['see', 'Wie heißt das Segelschulschiff der Deutschen Marine?', ['Gorch Fock', 'Bismarck', 'Titanic', 'Victory'], 'Auf der Gorch Fock lernen angehende Offiziere die Seefahrt.'],
  ['see', 'Was ist ein Torpedo?', ['Eine Waffe, die sich unter Wasser selbst antreibt', 'Ein kleines Rettungsboot', 'Ein Fisch', 'Ein Leuchtturm'], null],
  ['see', 'Was ist das Besondere an den U-Booten der Klasse 212A der Deutschen Marine?', ['Sie fahren mit Brennstoffzellen sehr leise und lange getaucht', 'Sie können fliegen', 'Sie haben Segel', 'Sie sind aus Holz'], null],
  ['see', 'Welche Klasse amerikanischer Flugzeugträger umfasst zehn Schiffe mit Atomantrieb?', ['Nimitz-Klasse', 'Bismarck-Klasse', 'Yamato-Klasse', 'Gorch-Fock-Klasse'], 'Ein Nimitz-Flugzeugträger ist über 330 Meter lang.'],
  ['see', 'Wie nennt man ein Schiff, auf dem Kampfflugzeuge starten und landen?', ['Flugzeugträger', 'Fregatte', 'Tanker', 'Schlepper'], null],
  ['see', 'Was ist eine Fregatte?', ['Ein mittelgroßes Kriegsschiff, oft zum Schutz anderer Schiffe', 'Ein U-Boot', 'Ein Flugzeug', 'Ein Panzer'], null],
  ['see', 'In welcher Einheit misst man die Geschwindigkeit von Schiffen?', ['Knoten', 'PS', 'Meter', 'Liter'], '1 Knoten ist 1 Seemeile pro Stunde.'],
  ['see', 'Wie lang ist eine Seemeile?', ['1,852 km', '1 km', '5 km', '100 m'], null],
  ['see', 'Was macht ein Minenjagdboot?', ['Es sucht und beseitigt Seeminen', 'Es legt Minen', 'Es fängt Fische', 'Es baut Brücken'], null],
  ['see', 'Wie heißt die größte Seeschlacht des Ersten Weltkriegs (1916)?', ['Skagerrakschlacht', 'Schlacht von Midway', 'Schlacht von Trafalgar', 'Schlacht von Salamis'], null],
  ['see', 'Welche Seeschlacht gewann Admiral Nelson im Jahr 1805?', ['Trafalgar', 'Waterloo', 'Verdun', 'Midway'], null],
  ['see', 'Wie heißt der Verband von mehreren Kriegsschiffen?', ['Flotte', 'Staffel', 'Kompanie', 'Zug'], null],
  ['see', 'Wofür braucht ein Schiff einen Anker?', ['Damit es an einer Stelle bleibt', 'Damit es schneller fährt', 'Zum Fischen', 'Als Waffe'], null],
  ['see', 'Wie heißt der Dienstgrad eines einfachen Soldaten bei der Marine?', ['Matrose', 'Schütze', 'Flieger', 'Kadett'], null],
  ['see', 'Was zeigt ein Leuchtturm den Schiffen?', ['Wo die Küste oder Gefahren sind', 'Wo es Fisch gibt', 'Wie spät es ist', 'Wie das Wetter wird'], null],

  // ---------- Ränge & Truppe ----------
  ['raenge', 'Welcher dieser Dienstgrade ist am höchsten?', ['Hauptmann', 'Leutnant', 'Feldwebel', 'Gefreiter'], 'Reihenfolge der Offiziere: Leutnant, Oberleutnant, Hauptmann, Major, Oberstleutnant, Oberst.'],
  ['raenge', 'Welcher dieser Dienstgrade ist der höchste?', ['General', 'Oberst', 'Major', 'Hauptmann'], null],
  ['raenge', 'Wer ist höher: Major oder Oberst?', ['Oberst', 'Major', 'Beide gleich', 'Keiner von beiden ist ein Dienstgrad'], null],
  ['raenge', 'Zu welcher Teilstreitkraft gehört der Dienstgrad „Admiral“?', ['Marine', 'Heer', 'Luftwaffe', 'Feuerwehr'], null],
  ['raenge', 'Was ist ein Feldwebel?', ['Ein Unteroffizier', 'Ein General', 'Ein Offizier', 'Ein Rekrut'], null],
  ['raenge', 'Der Leutnant ist der erste Dienstgrad der …', ['Offiziere', 'Mannschaften', 'Generale', 'Rekruten'], null],
  ['raenge', 'Welche Reihenfolge geht von klein nach groß?', ['Gruppe – Zug – Kompanie – Bataillon', 'Zug – Gruppe – Bataillon – Kompanie', 'Bataillon – Kompanie – Zug – Gruppe', 'Kompanie – Gruppe – Zug – Bataillon'], null],
  ['raenge', 'Welche dieser Einheiten ist am größten?', ['Bataillon', 'Kompanie', 'Zug', 'Gruppe'], null],
  ['raenge', 'Mehrere Gruppen bilden einen …', ['Zug', 'Bataillon', 'Division', 'Flotte'], null],
  ['raenge', 'Wer führt meistens eine Kompanie?', ['Ein Hauptmann als Kompaniechef', 'Ein General', 'Ein Gefreiter', 'Ein Admiral'], null],
  ['raenge', 'Die Bundeswehr hat Heer, Luftwaffe und …', ['Marine', 'Polizei', 'Feuerwehr', 'Bergwacht'], null],
  ['raenge', 'Wie heißt der ranghöchste Soldat der Bundeswehr?', ['Generalinspekteur', 'Oberbefehlshaber', 'Feldmarschall', 'Kaiser'], null],
  ['raenge', 'Wer hat im Frieden die Befehlsgewalt über die Bundeswehr?', ['Verteidigungsminister bzw. Verteidigungsministerin', 'Bundespräsident', 'Generalinspekteur', 'Bürgermeister'], 'Im Verteidigungsfall geht die Befehlsgewalt an den Bundeskanzler bzw. die Bundeskanzlerin über.'],
  ['raenge', 'Welcher Marine-Dienstgrad entspricht dem Oberst beim Heer?', ['Kapitän zur See', 'Matrose', 'Bootsmann', 'Korvettenkapitän'], 'Der Korvettenkapitän entspricht einem Major.'],
  ['raenge', 'Was ist ein Rekrut?', ['Ein neuer Soldat in der Grundausbildung', 'Ein General', 'Ein Panzer', 'Ein Funkgerät'], null],
  ['raenge', 'Wie heißt das typische Tarnmuster der Bundeswehr?', ['Flecktarn', 'Zebratarn', 'Karomuster', 'Streifentarn'], null],
  ['raenge', 'Was ist ein Barett?', ['Eine flache Mütze', 'Eine Waffe', 'Ein Fahrzeug', 'Ein Dienstgrad'], null],
  ['raenge', 'Welche Farbe hat das Barett der Fallschirmjäger der Bundeswehr?', ['Bordeauxrot', 'Gelb', 'Hellblau', 'Weiß'], null],
  ['raenge', 'Welche Farbe hat das Barett der Panzertruppe der Bundeswehr?', ['Schwarz', 'Rosa', 'Orange', 'Weiß'], null],
  ['raenge', 'Welche Farbe hat das Barett der Jäger und Panzergrenadiere der Bundeswehr?', ['Grün', 'Lila', 'Gelb', 'Weiß'], null],
  ['raenge', 'Wie nennt man Soldaten, die mit dem Fallschirm abspringen?', ['Fallschirmjäger', 'Gebirgsjäger', 'Panzergrenadiere', 'Pioniere'], null],
  ['raenge', 'Welche Soldaten bauen Brücken und räumen Hindernisse?', ['Pioniere', 'Piloten', 'Matrosen', 'Musiker'], null],
  ['raenge', 'Welche Soldaten sind für Kämpfe im Hochgebirge ausgebildet?', ['Gebirgsjäger', 'Kampfschwimmer', 'Panzerfahrer', 'Fallschirmjäger'], 'Ihr Abzeichen ist das Edelweiß.'],
  ['raenge', 'Wie heißt die Spezialeinheit der Bundeswehr beim Heer?', ['Kommando Spezialkräfte (KSK)', 'GSG 9', 'Navy SEALs', 'SAS'], 'Die GSG 9 gehört zur Bundespolizei, nicht zur Bundeswehr.'],

  // ---------- Geschichte ----------
  ['geschichte', 'In welchem Jahr endete der Zweite Weltkrieg in Europa?', ['1945', '1918', '1939', '1961'], 'Am 8. Mai 1945 endete der Krieg in Europa.'],
  ['geschichte', 'In welchem Jahr begann der Erste Weltkrieg?', ['1914', '1939', '1870', '1989'], null],
  ['geschichte', 'In welchem Jahr endete der Erste Weltkrieg?', ['1918', '1914', '1945', '1933'], null],
  ['geschichte', 'Mit dem deutschen Überfall auf welches Land begann 1939 der Zweite Weltkrieg?', ['Polen', 'Frankreich', 'Großbritannien', 'Norwegen'], null],
  ['geschichte', 'In welchem Jahr wurde die Bundeswehr gegründet?', ['1955', '1945', '1990', '1918'], 'Die ersten Soldaten wurden am 12. November 1955 ernannt.'],
  ['geschichte', 'Was ist die NATO?', ['Ein Verteidigungsbündnis vieler Länder', 'Ein Fußballverein', 'Eine Automarke', 'Eine Raumstation'], 'NATO heißt „North Atlantic Treaty Organization“.'],
  ['geschichte', 'In welchem Jahr wurde die NATO gegründet?', ['1949', '1914', '1990', '2001'], null],
  ['geschichte', 'In welchem Jahr trat die Bundesrepublik Deutschland der NATO bei?', ['1955', '1949', '1990', '1970'], null],
  ['geschichte', 'Wo landeten die Alliierten am 6. Juni 1944 (D-Day)?', ['In der Normandie', 'Auf Sizilien', 'In Norwegen', 'In Spanien'], null],
  ['geschichte', 'Was war die Berliner Luftbrücke 1948/49?', ['West-Berlin wurde aus der Luft mit Lebensmitteln versorgt', 'Eine Brücke aus Stahl', 'Eine Flugshow', 'Eine Bahnstrecke'], 'Die Flugzeuge, die Süßigkeiten abwarfen, nannten die Kinder „Rosinenbomber“.'],
  ['geschichte', 'In welchem Jahr fiel die Berliner Mauer?', ['1989', '1961', '1945', '2000'], null],
  ['geschichte', 'Wie hieß die Armee der DDR?', ['Nationale Volksarmee (NVA)', 'Reichswehr', 'Bundesheer', 'Rote Armee'], null],
  ['geschichte', 'Zwischen welchen beiden Supermächten herrschte der Kalte Krieg?', ['USA und Sowjetunion', 'Frankreich und Spanien', 'China und Japan', 'Italien und Österreich'], null],
  ['geschichte', 'Wie hieß ein großer Truppenverband im alten Rom?', ['Legion', 'Staffel', 'Kompanie', 'Flotte'], 'Eine römische Legion hatte etwa 5.000 Soldaten.'],
  ['geschichte', 'Welcher Feldherr aus Karthago zog mit Elefanten über die Alpen?', ['Hannibal', 'Caesar', 'Napoleon', 'Alexander'], null],
  ['geschichte', 'In welcher Schlacht wurde Napoleon 1815 endgültig besiegt?', ['Waterloo', 'Trafalgar', 'Verdun', 'Stalingrad'], null],
  ['geschichte', 'Wovor sollte die Chinesische Mauer schützen?', ['Vor Angriffen von Reitervölkern aus dem Norden', 'Vor Hochwasser', 'Vor wilden Tieren', 'Vor Piraten'], null],
  ['geschichte', 'Wie nennt man die Friedenssoldaten der Vereinten Nationen?', ['Blauhelme', 'Grünhelme', 'Rotkappen', 'Weißmützen'], null],
  ['geschichte', 'In welchem Jahr wurde die Wehrpflicht in Deutschland ausgesetzt?', ['2011', '1990', '1955', '2001'], null],
  ['geschichte', 'Wie hießen die schwer gepanzerten Reiter im Mittelalter?', ['Ritter', 'Legionäre', 'Samurai', 'Wikinger'], null],
  ['geschichte', 'Wie hießen die Krieger im alten Japan?', ['Samurai', 'Ritter', 'Wikinger', 'Spartaner'], null],
  ['geschichte', 'Wie heißt die griechische Stadt, deren Krieger für ihre harte Ausbildung berühmt waren?', ['Sparta', 'Athen', 'Rom', 'Troja'], null],
  ['geschichte', 'In welchem Jahr wurde Deutschland wiedervereinigt?', ['1990', '1989', '1955', '2000'], 'Am 3. Oktober 1990 – dem Tag der Deutschen Einheit.'],

  // ---------- Funk, Ausrüstung & Wissen ----------
  ['wissen', 'Wie lautet SOS im Morsecode?', ['··· ––– ···', '––– ··· –––', '·–·– ·–·–', '–··· ·–··'], 'Drei kurz, drei lang, drei kurz.'],
  ['wissen', 'Wofür steht „A“ im NATO-Buchstabieralphabet?', ['Alfa', 'Anton', 'Apfel', 'Adler'], null],
  ['wissen', 'Wofür steht „B“ im NATO-Buchstabieralphabet?', ['Bravo', 'Berta', 'Baum', 'Bingo'], null],
  ['wissen', 'Wofür steht „C“ im NATO-Buchstabieralphabet?', ['Charlie', 'Cäsar', 'Cola', 'Charly Brown'], null],
  ['wissen', 'Wofür steht „Z“ im NATO-Buchstabieralphabet?', ['Zulu', 'Zeppelin', 'Zebra', 'Zorro'], null],
  ['wissen', 'Wofür steht „X“ im NATO-Buchstabieralphabet?', ['X-Ray', 'Xylophon', 'Xaver', 'Xenon'], null],
  ['wissen', 'Wofür steht „M“ im NATO-Buchstabieralphabet?', ['Mike', 'Martha', 'Mama', 'Max'], null],
  ['wissen', 'Wofür steht „T“ im NATO-Buchstabieralphabet?', ['Tango', 'Theodor', 'Tiger', 'Toni'], null],
  ['wissen', 'Was sagt man im Funk für „Ich habe verstanden“?', ['Roger', 'Mayday', 'Bingo', 'Tango'], null],
  ['wissen', 'Was bedeutet der Funkruf „Mayday“?', ['Notruf bei Lebensgefahr', 'Feiertag', 'Landeanflug', 'Wetterbericht'], 'Mayday wird immer dreimal hintereinander gerufen.'],
  ['wissen', 'Was macht ein Nachtsichtgerät?', ['Es lässt einen im Dunkeln sehen', 'Es macht Musik', 'Es misst die Zeit', 'Es kocht Essen'], null],
  ['wissen', 'Was zeigt eine Wärmebildkamera?', ['Warme und kalte Stellen', 'Nur Farben', 'Die Uhrzeit', 'Radiosender'], null],
  ['wissen', 'Wie heißt die Verpflegung für einen Soldaten in einer Packung bei der Bundeswehr?', ['EPa (Einmannpackung)', 'Brotdose', 'Picknickkorb', 'Proviantkiste'], null],
  ['wissen', 'Wofür ist Tarnkleidung da?', ['Damit man in der Umgebung schwer zu sehen ist', 'Damit man schneller rennt', 'Damit man nicht friert', 'Damit man gut aussieht'], null],
  ['wissen', 'Was macht ein Radar?', ['Es ortet Dinge mit Funkwellen', 'Es fotografiert Sterne', 'Es misst Regen nur in Litern', 'Es filmt unter Wasser'], null],
  ['wissen', 'Womit sieht man weit entfernte Dinge mit beiden Augen größer?', ['Fernglas', 'Lupe', 'Mikroskop', 'Spiegel'], null],
  ['wissen', 'Wie viel Grad hat ein voller Kreis auf dem Kompass?', ['360°', '100°', '180°', '90°'], null],
  ['wissen', 'Welche Himmelsrichtung liegt gegenüber von Norden?', ['Süden', 'Osten', 'Westen', 'Nordwesten'], null],
  ['wissen', 'In welche Richtung zeigt die Nadel eines Kompasses?', ['Nach Norden', 'Nach Süden', 'Zur Sonne', 'Zum Mond'], null],
  ['wissen', 'Wo geht die Sonne auf?', ['Im Osten', 'Im Westen', 'Im Norden', 'Im Süden'], null],
  ['wissen', 'Wie heißt ein Funkgerät, das man in der Hand hält?', ['Handfunkgerät (Walkie-Talkie)', 'Fernseher', 'Radarschirm', 'Telegraf'], null],
  ['wissen', 'Was ist ein Feldlager?', ['Ein Lager aus Zelten für Soldaten im Einsatz', 'Ein Getreidefeld', 'Ein Bauernhof', 'Ein Lebensmittelladen'], null],
  ['wissen', 'Was ist ein Sanitäter?', ['Jemand, der Verletzte versorgt', 'Ein Koch', 'Ein Pilot', 'Ein Mechaniker'], null],
  ['wissen', 'Welches Zeichen schützt Sanitäter und Krankenhäuser im Krieg?', ['Rotes Kreuz', 'Grüner Stern', 'Blauer Kreis', 'Gelbes Dreieck'], 'Das Rote Kreuz ist durch die Genfer Konventionen geschützt.'],
  ['wissen', 'Wie viele Punkte und Striche hat der Buchstabe „E“ im Morsecode?', ['Einen Punkt', 'Einen Strich', 'Drei Punkte', 'Zwei Striche'], 'E ist der häufigste Buchstabe – deshalb hat er das kürzeste Zeichen.'],
  ['wissen', 'Was bedeutet die Uhrzeit „1800“ in der Militärsprache?', ['18:00 Uhr', '1:00 Uhr', '8:00 Uhr', '18 Minuten'], null],
];

// Jede Frage bekommt eine feste ID (Position in der Liste)
export const QUESTIONS = RAW.map(([cat, q, a, f], id) => ({ id, cat, q, a, f }));

export function pickQuestions(cat, n, rnd = Math.random) {
  const pool = QUESTIONS.filter((x) => cat === 'mix' || !CATEGORIES[cat] || x.cat === cat);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

// Mischt die Antworten einer Frage. Gibt { order, right } zurück: order[k] = Original-Index, right = Position der richtigen Antwort
export function shuffleAnswers(rnd = Math.random) {
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { order, right: order.indexOf(0) };
}

// Frage für den Client (ohne Lösung)
export function publicQuestion(q, order) {
  return { cat: q.cat, q: q.q, a: order.map((k) => q.a[k]) };
}

// Punkte für eine richtige Antwort, je schneller desto mehr
export const QUIZ_TIME = 20; // Sekunden pro Frage
export function answerPoints(correct, secs) {
  if (!correct) return 0;
  const s = Math.max(0, Math.min(QUIZ_TIME, secs));
  return 100 + Math.round((QUIZ_TIME - s) * 5);
}
