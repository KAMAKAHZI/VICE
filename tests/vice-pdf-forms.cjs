'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const lib=require('pdf-lib');
const source=fs.readFileSync('vice-mega.js','utf8').split('/* AcroForm editing:')[1];
const c=vm.createContext({window:{},document:{addEventListener(){}},console,Blob,setTimeout});
vm.runInContext('/* AcroForm editing:'+source,c);
const api=c.window.VicePdf;
async function fixture(){
 const pdf=await lib.PDFDocument.create(),page=pdf.addPage(),form=pdf.getForm();
 form.createTextField('full_name').addToPage(page,{x:50,y:500,width:250,height:30});
 form.createTextField('date').addToPage(page,{x:50,y:450,width:250,height:30});
 form.createCheckBox('consent').addToPage(page,{x:50,y:400,width:20,height:20});
 const choice=form.createDropdown('department');choice.addOptions(['Operations','Research']);choice.select('Operations');choice.addToPage(page,{x:50,y:350,width:250,height:30});
 return pdf.save();
}
test('AcroForm text/date, checkbox and selection survive PDF export/reload',async()=>{
 const bytes=await fixture(),copy=await api.edit(bytes,{full_name:'Test Member',date:'2026-10-15',consent:true,department:'Research'},lib);
 const pdf=await lib.PDFDocument.load(copy),f=pdf.getForm();assert.equal(f.getTextField('full_name').getText(),'Test Member');assert.equal(f.getTextField('date').getText(),'2026-10-15');assert.equal(f.getCheckBox('consent').isChecked(),true);assert.deepEqual(f.getDropdown('department').getSelected(),['Research']);
 const original=await lib.PDFDocument.load(bytes);assert.equal(original.getForm().getTextField('full_name').getText(),undefined);
});
test('PDF form rejects invalid selections and nonboolean checkboxes',async()=>{
 const bytes=await fixture();await assert.rejects(api.edit(bytes,{department:'Invalid'},lib),/Invalid selection/);await assert.rejects(api.edit(bytes,{consent:'yes'},lib),/must be boolean/);
});
test('Read-only fields remain unchanged',async()=>{
 const pdf=await lib.PDFDocument.load(await fixture());pdf.getForm().getTextField('full_name').setText('Locked');pdf.getForm().getTextField('full_name').enableReadOnly();
 const edited=await lib.PDFDocument.load(await api.edit(await pdf.save(),{full_name:'Changed'},lib));assert.equal(edited.getForm().getTextField('full_name').getText(),'Locked');
});
