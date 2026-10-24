unit Fnt;

interface

uses GLIB;

{ Globals }
type
	Font=Sprite;
const
	OK:string[100]='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.!?';

{ Funciton definitions }
Function LoadFont(Filename:string;var Dest:Font) : boolean;
procedure FreeFont(var a:font);
procedure VGAText(f:Font;where:word;src:string;x,y:integer;col:byte);

implementation


Function LoadFont(Filename:string;var Dest:Font) : boolean;
begin
	{ Load PCX font file }
	LoadFont:=SpriteLoadPCX(Filename,Dest);
end;



procedure FreeFont(var a:font);
begin
	Freemem(a.data,a.width*a.height);
end;



procedure VGAText(f:Font;where:word;src:string;x,y:integer;col:byte);
var
	i,p,j,k,width : integer;
	s1,o1 : word;
begin
	{ Check string }
	if Length(src)<1 then exit;

	{ Convert to uppercase }
	for i:=1 to Length(src) do
		src[i]:=UpCase(src[i]);

	{ Set width }
	width:=f.width;
	if (f.width and 1)=1 then
		Dec(width);

	{ Loop through string }
	Dec(x);
	for i:=1 to Length(src) do begin
		{ Get character position }
		p:=Pos(src[i],OK);

		{ Set pointer }
		s1:=seg(f.data^);
		o1:=ofs(f.data^)-1+(width div 39)*(p-1);

		{ If found, display }
		if p>0 then begin
			for k:=y to y+f.height-1 do
				begin
					for j:=1 to (width div 39) do
						if mem[s1:o1+j]<>0 then
							PutPixel(where,x+j,k,col);
					Inc(o1,f.width);
				end;
			end;

		{ Move across a bit }
		Inc(x,f.width div 39);
	end;
end;


end.