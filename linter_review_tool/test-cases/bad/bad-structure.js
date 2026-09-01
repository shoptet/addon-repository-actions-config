export function structure(list, cb) {
  list.forEach((a) => { a.forEach((b) => { b.forEach((c) => { c.forEach((d) => cb(d)); }); }); }); // max-nested-callbacks
  const v1 = 1;
  cb(v1);
  const v2 = 2;
  cb(v2);
  const v3 = 3;
  cb(v3);
  const v4 = 4;
  cb(v4);
  const v5 = 5;
  cb(v5);
  const v6 = 6;
  cb(v6);
  const v7 = 7;
  cb(v7);
  const v8 = 8;
  cb(v8);
  const v9 = 9;
  cb(v9);
  const v10 = 10;
  cb(v10);
  const v11 = 11;
  cb(v11);
  const v12 = 12;
  cb(v12);
  const v13 = 13;
  cb(v13);
  const v14 = 14;
  cb(v14);
  const v15 = 15;
  cb(v15);
  const v16 = 16;
  cb(v16);
  const v17 = 17;
  cb(v17);
  const v18 = 18;
  cb(v18);
  const v19 = 19;
  cb(v19);
  const v20 = 20;
  cb(v20);
  const v21 = 21;
  cb(v21);
  if (list.length === 1) { cb(1); }
  if (list.length === 2) { cb(2); }
  if (list.length === 3) { cb(3); }
  if (list.length === 4) { cb(4); }
  if (list.length === 5) { cb(5); }
  if (list.length === 6) { cb(6); }
  if (list.length === 7) { cb(7); }
  if (list.length === 8) { cb(8); }
  if (list.length === 9) { cb(9); }
  if (list.length === 10) { cb(10); }
  if (list.length === 11) { cb(11); }
  return list.length;
}
