/* Pure review logic shared by the interface and automated checks. */
'use strict';
(() => {
  const statuses = ['conflict', 'missing', 'unclear', 'aligned'];
  const labels = {conflict:'Conflicts', missing:'Not addressed', unclear:'Needs clarification', aligned:'Aligned claims'};
  const symbols = {conflict:'↗', missing:'−', unclear:'?', aligned:'✓'};
  function filterFindings(findings, states, filter, search) {
    const query = search.trim().toLowerCase();
    return findings.map((row,index) => ({row,index})).filter(({row,index}) => {
      const state = states[index];
      if (filter === 'open' && row.status === 'aligned') return false;
      if (filter === 'reviewed' && !state.reviewed) return false;
      if (statuses.includes(filter) && row.status !== filter) return false;
      return !query || [row.topic,row.explanation,row.requirement_quote,row.supplier_quote,state.note].join(' ').toLowerCase().includes(query);
    }).sort((a,b) => statuses.indexOf(a.row.status)-statuses.indexOf(b.row.status) || a.index-b.index);
  }
  function compose(findings, states, tone) {
    const questions = findings.filter((row,index) => row.status !== 'aligned' && states[index].include).map(row=>row.question);
    if (!questions.length) return {count:0,text:'No follow-up questions selected. Return to Findings and include the points you want to clarify.'};
    const wording = {
      direct:['Hi,','Before we approve the sample, please confirm the following:','Thank you.'],
      formal:['Dear supplier,','Before proceeding with sample approval, please provide written confirmation of the following points:','Thank you for your clarification.\nKind regards,'],
      friendly:['Hi,','Thanks for the update. A few details to clarify before we move forward:','Thanks for your help!']
    };
    const [hello,intro,closing] = wording[tone] || wording.direct;
    return {count:questions.length,text:`${hello}\n\n${intro}\n\n${questions.map((q,i)=>`${i+1}. ${q}`).join('\n\n')}\n\n${closing}`};
  }
  function csvCell(value) {
    let text = String(value ?? '');
    // Spreadsheet formula injection protection applies to every exported text field.
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g,'""') + '"';
  }
  function csv(report) {
    const fields = ['topic','status','requirement_quote','supplier_quote','explanation','question','reviewed','note','include_in_follow_up'];
    return '\uFEFF' + [fields, ...report.findings.map(row=>fields.map(key=>row[key]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  function markdown(report) {
    const plain = text=>String(text ?? '').replace(/[\\`*_{}[\]<>#!|]/g,'\\$&');
    const quote = text=>String(text ?? '').split('\n').map(line=>'> '+plain(line)).join('\n');
    return '# SupplyLens review\n\n' + `Mode: ${report.mode === 'structured' ? 'Rule-based specification comparison' : report.mode === 'demo' ? 'Sample replay (fixed fixture)' : 'Live AI'}  \nExported: ${report.exported_at}\n\n` +
      report.findings.map((r,i)=>`## ${i+1}. ${plain(r.topic)}\n\nStatus: **${r.status}** · Reviewed: **${r.reviewed?'yes':'no'}**\n\n${plain(r.explanation)}\n\nRequirement:\n\n${quote(r.requirement_quote)}\n\nSupplier:\n\n${quote(r.supplier_quote||'No relevant statement.')}\n\n${r.note?'Review note: '+plain(r.note)+'\n\n':''}${r.question?'Question: '+plain(r.question)+'\n\n':''}`).join('') +
      '## Follow-up\n\n' + plain(report.subject) + '\n\n' + plain(report.follow_up) + '\n\n## Source documents\n\n### Requirements\n\n' + quote(report.documents.brief) + '\n\n### Supplier reply\n\n' + quote(report.documents.reply) + '\n';
  }
  globalThis.SupplyLensCore = Object.freeze({statuses,labels,symbols,filterFindings,compose,csvCell,csv,markdown});
})();
