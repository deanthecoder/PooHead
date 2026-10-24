function CardCount(a:Array of Card) : String;
var
	Count,i	:	Integer;
	S				:	String;
begin
	Count:=0;
	for i:=0 to 51 do
		if a[i].Suit<>0 then Inc(Count);

	Str(Count,S);
	CardCount:=S;
end;



procedure InfoBox;
var
	width,height	:	integer;
	Temp					:	ScreenType;
begin
	{ Get memory for a secondary screen }
	GetMem(Temp,64000);

	{ Grab screen to Temp variable }
	CoverMouse;
	Dump($a000,seg(Temp^));
	UnCoverMouse;

	{ Expand box }
	Width:=2;
	Height:=2;

	repeat
		{ Resize }
		if width<90 then Inc(Width,3);
		if height<35 then Inc(Height,6);

		{ Draw }
		SolidRectangle(vAddr,0,0,Width,Height,172);
		Rectangle(vAddr,1,1,Width-1,Height-1,0);

		{ Display changles }
		Waitvlb;
		Dump(vAddr,$a000);
	until (width>=90) and (height>=35);

	{ Display Infomation }
	VGAText(SmallFont,vAddr,'information',5,3,0);
	VGAText(SmallFont,vAddr,'pile size',5,13,0);
	VGAText(SmallFont,vAddr,'cpu 1 cards',5,19,0);
	VGAText(SmallFont,vAddr,'cpu 2 cards',5,25,0);
	VGAText(SmallFont,vAddr,'player cards',5,31,0);

	VGAText(SmallFont,vAddr,CardCount(Pile),73,13,210);
	VGAText(SmallFont,vAddr,CardCount(Player[2].Hand),73,19,210);
	VGAText(SmallFont,vAddr,CardCount(Player[3].Hand),73,25,210);
	VGAText(SmallFont,vAddr,CardCount(Player[1].Hand),73,31,210);

	{ Display changes }
	Dump(vAddr,$a000);

	{ Get mouse response }
	repeat
		updatemouse;
	until (m.rmr<>0) or (m.lmr<>0);

	while keypressed do readkey;

	{ Restore old screen }
	Dump(seg(Temp^),vAddr);
	Dump(vAddr,$a000);
	UnCoverMouse;

	{ Free screen memory for Exit }
	FreeMem(Temp,64000);
end;