procedure ShadeBackground; forward;

{ Global Sprites }
var
	Background	: sprite;
	SmallFont		:	sprite;
	Title				: sprite;
	BigTitle		: sprite;

{ Halt with 'load' error message }
Procedure LoadError;
begin
	Textmode;
	Writeln('Error loading graphics file.');
	Halt;
end;



{ Load Graphics }
Procedure LoadGraphics;
var
	i,j	:	integer;
	NewPal	:	Array[0..767] of byte;
begin
	{ Load sprites }
	if SpriteLoadPCX('backgrnd.spr',Background)=0 then LoadError;
	if SpriteLoadPCX('logo.spr',Title)=0 then LoadError;

	{ Load fonts }
	LoadFont('4x5.fnt',Smallfont);

	{ Set palette to black }
	for i:=0 to 255 do
		SetColor(i,0,0,0);
	Waitvlb;

	{ Display intro screen }
	if SpriteLoadPCX('title.spr',BigTitle)=0 then LoadError;
	ShadeBackground;
	TSpritePut($a000,(320-Bigtitle.width) div 2,(200-Bigtitle.height) div 2,BigTitle,0);
	FreeSprite(BigTitle);
	VGAText(Smallfont,$a000,'written by edis enterprises',91,140,72);
	VGAText(Smallfont,$a000,'written by edis enterprises',93,140,72);
	VGAText(Smallfont,$a000,'written by edis enterprises',91,139,72);
	VGAText(Smallfont,$a000,'written by edis enterprises',93,141,72);
	VGAText(Smallfont,$a000,'written by edis enterprises',92,140,180);

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

	{ Wait }
	Delay(3500);

	{ Fade down }
	for i:=63 downto 0 do begin
		for j:=0 to 767 do begin
			if i<Background.palette[j] then
				NewPal[j]:=i
			else
				NewPal[j]:=Background.palette[j];
		end;
		SetPalette(NewPal);
		Waitvlb;
	end;
	Delay(500);

	{ Exit }
	Cls($a000,0);
end;



{ Free graphics }
Procedure FreeGraphics;
begin
	{ Free sprite memory }
	FreeSprite(Background);
	FreeSprite(Title);

	{ Free font memory }
	Freefont(SmallFont);
end;