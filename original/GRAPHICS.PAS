Function AnotherGo:boolean;forward;

const
	slc=210;



procedure DrawDesign(Where:word;x,y:integer;Design:String;Col:byte);
var
	i,j					: Integer;
begin
	for j:=1 to 7 do
		for i:=1 to 7 do
			if Design[((j-1)*7)+i]<>' ' then
				PutPixel(Where,x+i-1,y+j-1,Col);
end;



procedure DrawCard(Visible:boolean;a:Card;Where:word;x,y:integer);
var
	xPos,yPos		: Array [1..12] of integer;
	Layout			: string[12];
	c,i,j					: Integer;
	SuitGraphic	: String[49];
	SuitColor		: byte;
	NumStr			: String[2];
begin
	{ Draw front }
	SolidRectangle(Where,x,y,x+44,y+59,215);
	Rectangle(Where,x+1,y+1,x+43,y+58,0);

	{ Draw Back of card }
	if not Visible then begin
		SolidRectangle(Where,x+3,y+3,x+41,y+56,18);
		for i:=1 to 39 do begin
			Line(Where,x+3,y+56,x+i+2,y+3,24);
			Line(Where,x+41,y+3,x+42-i,y+56,24);

			Inc(i,2);
		end;

		Exit;
	end;

	{ Create initial suit layout }
	c:=1;
	for i:=1 to 4 do
		for j:=1 to 3 do begin
			xPos[c]:=(j*10)-1+x;
			yPos[c]:=(i*10)+2+y;
			Inc(c);
		end;

	{ Define positions }
	case a.Value of
		14:	Layout:='000010000000';
		15: Layout:='010000000010';
		3	: Layout:='101000000010';
		4	: Layout:='101000000101';
		5	: Layout:='101010000101';
		6	: Layout:='100110011001';
		7	: Layout:='010111111000';
		8	: Layout:='101101101101';
		9	: Layout:='101111101101';
		16: Layout:='111101101111';

		11:	Layout:='111010010110';
		12:	Layout:='111101101110';
		13:	Layout:='101110110101';
	end;

	{ Create suit graphic }
	case a.Suit of
		1	:	SuitGraphic:=	'   л   '+
											'  ллл  '+
											' ллллл '+
											'ллллллл'+
											' л л л '+
											'   л   '+
											'       ';

		2	:	SuitGraphic:=	'   л   '+
											'  ллл  '+
											' л л л '+
											'ллллллл'+
											' л л л '+
											'   л   '+
											'       ';

		3	:	SuitGraphic:=	' лл лл '+
											'ллллллл'+
											'ллллллл'+
											'ллллллл'+
											' ллллл '+
											'   л   '+
											'       ';

		4	:	SuitGraphic:=	'   л   '+
											'  ллл  '+
											' ллллл '+
											'ллллллл'+
											' ллллл '+
											'  ллл  '+
											'   л   ';
	end;
	if a.Suit<3 then SuitColor:=0 else SuitColor:=24;

	{ Draw design on Card face }
	for i:=1 to 12 do
		if Layout[i]='1' then
			DrawDesign(Where,xPos[i],yPos[i],SuitGraphic,SuitColor);

	{ Queen? }
	if a.Value=12 then begin
		Line(Where,xPos[8]+6,yPos[8]+6,xPos[12]+6,yPos[12]+6,Suitcolor);
		Line(Where,xPos[8]+7,yPos[8]+6,xPos[12]+7,yPos[12]+6,Suitcolor);
	end;

	{ Get card number }
	if a.Number=' ' then
		NumStr:='10'
	else
		NumStr:=a.Number;

	{ Display card number }
	VGAText(SmallFont,Where,NumStr,x+3,y+3,SuitColor);

	if Length(NumStr)=1 then
		VGAText(SmallFont,Where,NumStr,x+38,y+51,SuitColor)
	else
		VGAText(SmallFont,Where,NumStr,x+33,y+51,SuitColor);
end;



procedure Darken(Where:word;x1,y1,x2,y2:integer);
var
	i					: Integer;
	Pntr			: Word;
begin
	{ Initialise }
	Pntr:=pplookup[y1]+x1;

	{ Darken }
	for i:=y1 to y2 do begin
		asm
			{ Set source and dest }
			push ds
			mov ds,Where
			mov si,Pntr

			mov es,Where
			mov di,si

			{ Do row }
			mov cx,x2
			sub cx,x1
			inc cx
			shr cx,1

		@LoopX :
			lodsw
			dec ah
			dec al
			stosw


			loop @LoopX

			pop ds
		end;

		Inc(Pntr,320);
	end;
end;



procedure DrawScrollButton(Where:word;x,y:integer;Str:string);
var
	col : Integer;
begin
	{ Draw button }
	SolidRectangle(Where,x,y,x+9,y+29,172);
	Line(Where,x,y,x,y+29,215);
	Line(Where,x,y,x+9,y,215);
	Line(Where,x+9,y+1,x+9,y+29,129);
	Line(Where,x+1,y+29,x+9,y+29,129);

	{ Get arrow color }
	col:=129;
	case x of
		3		:	if LeftCard>7 then col:=0;
		306	:	if Player[1].Hand[LeftCard+5].Suit<>0 then col:=0;
	end;

	{ Draw Arrow }
	DrawDesign(Where,x+2,y+12,Str,col);
end;



procedure DrawButtons(Where:word);
var
	Left,Right		: string[49];
begin
	{ Define Arrows }
	Left:='   0   '+
				'  00   '+
				' 00000 '+
				'000000 '+
				' 00000 '+
				'  00   '+
				'   0   ';

	Right:=
				'  0    '+
				'  00   '+
				'00000  '+
				'000000 '+
				'00000  '+
				'  00   '+
				'  0    ';

	{ Draw Left and right buttons }
	DrawScrollButton(Where,3,140,Left);
	DrawScrollButton(Where,306,140,Right);
end;



procedure DrawBackground;
begin
	{ Draw background (virtual) }
	Tile(vAddr,Background);

	{ Display Title }
	tSpritePut(vAddr,10,2,Title,0);

	{ Draw 'Hand' Area }
	Darken(vAddr,0,191,319,197);
	VGAText(SmallFont,vAddr,'Primary Hand',130,192,180);
	DrawButtons(vAddr);

	{ Draw secondary hand area }
	Darken(vAddr,5,17,151,98);
	VGAText(SmallFont,vAddr,'Secondary Hand',42,92,180);

	{ Draw Deck space }
	Darken(vAddr,241,17,300,98);
	VGAText(SmallFont,vAddr,'Top Card',251,92,180);

	{ Draw Info square }
	SolidRectangle(vAddr,0,0,2,2,172);
end;



procedure DrawTopHand;
var
	i 	: integer;
begin
	{ Draw top hand }
	for i:=1 to 3 do begin
		if Player[1].Hand[i].suit<>0 then
			DrawCard(False,Player[1].Hand[i],vAddr,(i*47)-38,20);
		if Player[1].Hand[i+3].suit<>0 then
			DrawCard(True,Player[1].Hand[i+3],vAddr,(i*47)-38,27);
	end;
end;



procedure DrawMainHand;
var
	i 	: integer;
begin
	{ Draw hand }
	for i:=LeftCard to LeftCard+4 do
		if Player[1].Hand[i].suit<>0 then
			DrawCard(True,Player[1].Hand[i],vAddr,30+(i-LeftCard)*54,125);
end;



procedure DrawHand(num : integer);
begin
	if num=Main then
		DrawMainHand
	else
		DrawTopHand;
end;



procedure DrawDeck;
begin
	{ No cards? }
	if Pile[1].suit=0 then Exit;

	{ More than one layed? }
	if Pile[3].suit<>0 then
		DrawCard(False,Pile[1],vAddr,250,27);
	if Pile[2].suit<>0 then
		DrawCard(False,Pile[1],vAddr,248,25);

	{ Display Top Card }
	DrawCard(True,Pile[1],vAddr,246,23);
end;



procedure DrawAll;
begin
	DrawBackground;
	DrawHand(Main);
	DrawHand(Tr);
	DrawDeck;
end;



procedure UpdateSelection(All : Boolean);
var
	x,y,i : Integer;
begin
	{ Draw Screen }
	if All then begin
		DrawAll;
		Dump(vAddr,$a000);
	end;

	{ Select Main hand }
	for i:=LeftCard to LeftCard+4 do
		if CardSelected[i] then begin
			x:=30+(i-LeftCard)*54;
			y:=125;
			Rectangle(vAddr,x-1,y-1,x+45,y+60,slc);
		end;

	{ Select secondary hand (Top cards) }
	for i:=4 to 6 do
		if CardSelected[i] then begin
			x:=((i-3)*47)-38;
			y:=27;
			Rectangle(vAddr,x-1,y-1,x+45,y+60,slc);
		end;

	{ Select secondary hand (Underneath top cards) }
	for i:=1 to 3 do
		if CardSelected[i] then begin
			x:=(i*47)-38;
			y:=20;
			Rectangle(vAddr,x-1,y-1,x+45,y+60,slc);
		end;

	{ Display changes }
	Dump(vAddr,$a000);
	UnCoverMouse;

	{ If no cards selected, reset SelectedValue }
	x:=0;
	for i:=1 to 52 do
		if CardSelected[i] then
			x:=i;

	if x=0 then SelectedValue:=0;
end;



procedure ZoomBox(x1,y1,x2,y2:integer);
var
	cx,i : integer;
begin
	cx:=(x2-x1) div 2;
	for i:=1 to cx do begin
		WaitVlb;
		SolidRectangle($a000,160-i,85,160+i,115,72);
		Rectangle($a000,160-i,85,160+i,115,180);

		Inc(i,5);
		if i>cx then i:=cx;
	end;
end;



procedure Message(Mes:String);
var
	x	:	Integer;
begin
	{ Store current screen }
	CoverMouse;
	Dump($a000,vAddr);
	UnCoverMouse;

	{ Work out sizes }
	x:=(320-(5*Length(Mes))) div 2;

	{ Zoom effect }
	ZoomBox(x-20,85,x+(5*Length(Mes))+20,115);

	{ Display Message box }
	SolidRectangle($a000,x-20,85,x+(5*Length(Mes))+20,115,72);
	Rectangle($a000,x-21,84,x+(5*Length(Mes))+21,116,72);
	Rectangle($a000,x-20,85,x+(5*Length(Mes))+20,115,180);

	VGAText(SmallFont,$a000,Mes,x,97,180);

	{ Wait }
	if GoFast then
		delay(80)
	else
		delay(800);

	{ Finale? }
	if Finale then wait(120);

	{ Restore old screen }
	Dump(vAddr,$a000);
	UnCoverMouse;

	{ Exit ? }
	if keypressed then begin
		while Keypressed do Readkey;
		if not AnotherGo then begin
			{ Free previously allocated data }
			FreeGraphics;

			{ Set text mode }
			Textmode;
			Writeln('Thankyou for playing ShitHead!');
			halt;
		end;
	end;
end;



Function AnotherGo:boolean;
var
	x		:	Integer;
	Mes	:	String;
begin
	{ Create message }
	Mes:='Left mouse button continues or Right quits.';

	{ Store current screen }
	CoverMouse;
	Dump($a000,vAddr);
	UnCoverMouse;

	{ Clear buffer }
	while keypressed do readkey;

	{ Work out sizes }
	x:=(320-(5*Length(Mes))) div 2;

	{ Display Message box }
	ZoomBox(x-20,85,x+(5*Length(Mes))+20,115);

	SolidRectangle($a000,x-20,85,x+(5*Length(Mes))+20,115,72);
	Rectangle($a000,x-21,84,x+(5*Length(Mes))+21,116,72);
	Rectangle($a000,x-20,85,x+(5*Length(Mes))+20,115,180);

	VGAText(SmallFont,$a000,Mes,x,97,180);

	{ Wait }
	repeat
		mCheck;
	until (m.rmr<>0) or (m.lmr<>0);

	if m.rmr<>0 then
		AnotherGo:=False
	else
		AnotherGo:=True;

	{ Restore old screen }
	Dump(vAddr,$a000);
	UnCoverMouse;
end;



procedure FadeOn;
var
	i,j	:	integer;
	NewPal	:	Array[0..767] of byte;
begin;
	{ Fade up }
	for i:=0 to 63 do begin
		for j:=0 to 767 do begin
			if i<Background.palette[j] then
				NewPal[j]:=i
			else
				NewPal[j]:=Background.palette[j];
		end;
		SetPalette(NewPal);
		Waitvlb;
	end;
end;



procedure ShadeBackground;
var
	i,c	:	integer;
begin
	{ Change background palette }
	c:=648;
	for i:=0 to 39 do begin
		Background.palette[c]:=0;		Inc(c);
		Background.palette[c]:=0;		Inc(c);
		Background.palette[c]:=i;	Inc(c);
	end;

	{ Shade background }
	for i:=0 to 199 do
		Line($a000,0,i,319,i,216+(i div 5));
end;
