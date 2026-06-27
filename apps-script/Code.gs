/**
 * OpenYap Command Center — RFI Drive lister
 * Lists the RFI folder and returns parsed metadata as JSON for the web app.
 * The Command Center stores only the LINK (viewUrl), never the PDF itself.
 *
 * Deploy: Extensions/▶ → New deployment → Web app
 *   - Execute as: Me
 *   - Who has access: Anyone (so the static site can fetch it)
 * Copy the /exec URL into index.html → RFI_API_URL.
 */

var RFI_FOLDER_ID = '1Aj71L_HnbTCTA9E8hmEGaXd2x6oJrYqA';

function doGet(e) {
  var out = [];
  try {
    var folder = DriveApp.getFolderById(RFI_FOLDER_ID);
    var files = folder.getFiles();
    while (files.hasFiles ? files.hasFiles() : files.hasNext()) {
      var f = files.next();
      var title = f.getName();
      out.push({
        number:   parseNumber_(title),
        title:    parseSubject_(title),
        status:   parseStatus_(title),
        viewUrl:  f.getUrl(),
        modified: f.getLastUpdated().toISOString()
      });
    }
  } catch (err) {
    return json_({ error: String(err) });
  }
  // newest RFI number first
  out.sort(function(a, b){ return (b.number || '').localeCompare(a.number || '', undefined, { numeric:true }); });
  return json_(out);
}

function parseNumber_(name) {
  var m = name.match(/RFI[-\s]?0*\d+(?:\.\d+)?/i);
  if (m) return m[0].replace(/\s+/g, '-').toUpperCase();
  return name.replace(/\.[^.]+$/, '').slice(0, 24);
}

function parseStatus_(name) {
  if (/\bclosed\b/i.test(name))   return 'Closed';
  if (/\bvoid(ed)?\b/i.test(name)) return 'Closed';
  if (/\banswered\b/i.test(name)) return 'Answered';
  if (/\bdraft\b/i.test(name))    return 'Open';
  return 'Open';
}

function parseSubject_(name) {
  var s = name.replace(/\.[^.]+$/, '');                 // drop extension
  s = s.replace(/^RFI[-\s]?0*\d+(?:\.\d+)?\s*[-–]?\s*/i, ''); // drop "RFI-00156.0 - "
  s = s.replace(/\s*[-–]\s*(closed|open|answered|void(ed)?)\s*(package)?$/i, ''); // drop trailing status
  s = s.replace(/\s*[-–]\s*package$/i, '');
  return s.trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
