const express=require("express");
const multer=require("multer");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const archiver=require("archiver");
const app=express(),PORT=process.env.PORT||3000,ROOT=__dirname,TMP=path.join(ROOT,"tmp"),OUT=path.join(ROOT,"output");
[TMP,OUT].forEach(x=>fs.mkdirSync(x,{recursive:true}));
const upload=multer({dest:TMP,limits:{fileSize:500*1024*1024},fileFilter:(req,file,cb)=>{const ok=path.extname(file.originalname).toLowerCase()===".apk";cb(ok?null:new Error("Разрешены только APK-файлы"),ok)}});
app.use(express.static(path.join(ROOT,"public")));
app.use("/downloads",express.static(OUT));
function zipDir(src,dst){return new Promise((resolve,reject)=>{const output=fs.createWriteStream(dst),archive=archiver("zip",{zlib:{level:9}});output.on("close",resolve);archive.on("error",reject);archive.pipe(output);archive.directory(src,false);archive.finalize()})}
app.post("/api/convert",upload.single("apk"),async(req,res)=>{if(!req.file)return res.status(400).json({error:"APK-файл не загружен"});const id=crypto.randomUUID(),work=path.join(TMP,id),pkg=path.join(work,"package");fs.mkdirSync(pkg,{recursive:true});const apk=path.join(pkg,"app.apk");fs.renameSync(req.file.path,apk);
fs.writeFileSync(path.join(pkg,"run-app.bat"),"@echo off\r\nwhere adb >nul 2>&1\r\nif errorlevel 1 (echo ADB не найден. Установите Android runtime/emulator с ADB.&pause&exit /b 1)\r\nadb install -r \"%~dp0app.apk\"\r\nif errorlevel 1 (echo Не удалось установить APK.&pause&exit /b 1)\r\necho APK установлен. Запустите приложение в Android runtime.\r\npause\r\n");
fs.writeFileSync(path.join(pkg,"README.txt"),"APK -> Windows package\n\nЭто не переименование APK в EXE. Пакет содержит APK и Windows launcher. Для запуска нужен Android-compatible runtime/emulator с ADB.\n");
const base=(req.file.originalname||"app.apk").replace(/[^a-zA-Z0-9._-]/g,"_").replace(/\.apk$/i,"")||"app",name=base+"-windows-package.zip",out=path.join(OUT,id+"-"+name);
try{await zipDir(pkg,out);res.json({ok:true,filename:name,download:"/downloads/"+id+"-"+name})}catch(e){res.status(500).json({error:e.message||"Ошибка сборки"})}finally{fs.rmSync(work,{recursive:true,force:true})}});
app.use((e,req,res,next)=>res.status(400).json({error:e.message||"Ошибка"}));
app.listen(PORT,()=>console.log("APK/EXE Converter listening on "+PORT));