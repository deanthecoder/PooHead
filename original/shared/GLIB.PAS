{----------------------------------------------------------------------------}

unit GLIB;

interface

uses crt,memory;

const
	VGA = $a000;

{----------------------------------------------------------------------------}

{$i ..\charmap.pas }


Type
	Virtual = Array [1..64000] of byte;
	VirtPtr = ^Virtual;
	VirtPal = Array [0..767] of byte;

	Sprite = record
		width,height : integer;
		palette : ^VirtPal;
		data : VirtPtr;
	end;

var
	vscreen : VirtPtr;
	vAddr : word;
	ppLookup : Array[0..399] of integer;
	CreatePalette	:	Boolean;

const
	VGAt	=	0;
	VGAn	=	1;
	VGAx	=	2;
	VideoMode:byte=VGAt;
	Page:byte=0;

var
	ActStart		:	Word;
	ScrnHeight	:	Integer;


{----------------------------------------------------------------------------}


{ Procedure definitions }
Procedure ModeVGA;
Procedure TextMode;
Procedure Cls(Where:word;color:byte);
Procedure PutPixel(Where:word;x,y:integer;color:byte);
Function GetPixel(Where,x,y:word):byte;
Procedure Dump(Src,Dst : word);
Procedure Waitvlb;
Procedure Error(str : string);
Procedure GetPalette(var pal : array of byte);
Procedure SetPalette(pal : array of byte);
Procedure SetColor(p : integer; r,g,b : byte);
Procedure DotLine(Where : word;x1,y1,x2,y2 : longint;dots : integer;col : byte);
function OnScreen(x,y : word) : boolean;
Procedure CloseGraph;

Procedure SpritePut(where:word;x,y:integer;Src:Sprite);
Procedure TSpritePut(where:word;x,y:integer;Src:Sprite);
Procedure TPaintPut(where:word;x,y:integer;Src:Sprite;Col:word);
Procedure Beep;
Procedure PolygonN(Where:word;x,y:Array of integer;num:integer;Col:byte);
Procedure Polygon(Where:word;x1,y1,x2,y2,x3,y3,x4,y4:integer;Col:Byte);
Procedure FreeSprite(var a : sprite);
Procedure GetSpriteMem(var a : sprite);
Procedure Tile(Where:word;a:Sprite);
procedure Rectangle(where:word;x1,y1,x2,y2:integer;col:byte);
procedure SolidRectangle(where:word;x1,y1,x2,y2:integer;col:byte);
Procedure Line(Where:word;a,b,c,d:integer;col:byte);
Function Rad(x:integer) : integer;
Procedure Wait(num:integer);
procedure HLine(Where:word;a,b,c:integer;col:byte);
procedure VLine(Where:word;y1,x,y2:integer;col:byte);


procedure PutPixelX(x,y:integer;color:byte);
function GetPixelX(pg:byte;x,y:integer):byte;
procedure CopyPageX(srce,dest:byte);
procedure ModeX;
procedure ModeX400;
procedure ModeX240;
procedure SetActiveX(page:integer);
procedure SetVisualX(page:integer);
procedure SetWritePlaneX(plane:byte);
procedure SetReadPlaneX(plane:byte);
procedure SetAllPlanesX;
procedure HLineX(y,x1,x2:integer;color:byte);
procedure SpritePutX(x,y:integer;srce:sprite);
procedure SolidRectangleX(left,top,right,bottom:integer;color:byte);
procedure ClsX(color:byte);
procedure LineX(a,b,c,d:integer;color:byte);
procedure UpdateAreaX(p1,p2:byte;left,top,right,bottom:integer);
Procedure PolygonX(x1,y1,x2,y2,x3,y3,x4,y4:integer;Col:Byte);


Function SpriteLoadPCX(filename:string;var dest:Sprite) : boolean;
Function GetPCXInfo(filename:string;var width,height:integer) : boolean;
Function LoadPCXPalette(filename:string;var dest:Array of byte) : boolean;

{----------------------------------------------------------------------------}

implementation

{ Set Mode 13 }
Procedure ModeVGA;
begin
	{ Grab memory }
	vscreen:=MemAllocSEG(64000);
	if vscreen=NIL then
		begin
			writeln('MODEVGA : Error allocating screen memory.');
			Halt;
		end;

	vAddr:=seg(vscreen^);

	{ Set mode }
	asm
		mov ax,13h
		int 10h
	end;

	{ Clear screen }
	Cls(vAddr,0);
end;



{ Set text mode }
Procedure TextMode;
begin
	{ Set mode }
	asm
		mov ax,3h
		int 10h
	end;
	VideoMode:=VGAt;

	{ Free memory }
	if VideoMode=VGAn then
		FreeMem(vscreen,64000);
end;



{ Clear buffered screen }
Procedure Cls(Where:word;color:byte); assembler;
asm
	{ Set dest  }
	mov es,Where
	xor di,di

	{ Set color }
	mov al,color
	mov ah,al

	mov cx,ax
	db $66;shl ax,16
	mov ax,cx

	{ Write bytes }
	mov cx,16000
	rep; db $66; stosw
end;



{ Put a pixel }
Procedure PutPixel(Where:word;x,y:integer;color:byte); assembler;
asm
	mov ax,x
	mov bx,y

	{ Check bounds }
	cmp ax,0
	jl @Okay
	cmp ax,319
	jg @Okay

	cmp bx,0
	jl @Okay
	cmp bx,199
	jg @Okay

	{ Screen offset }
	lea di,pplookup
	add di,bx
	add di,bx
	mov di,[ds:di]

	add di,ax

	{ Set dest }
	mov es,Where

	{ Set color }
	mov al,color

	{ Write }
	stosb

 @Okay:
end;



{ Get a pixel }
Function GetPixel(Where,x,y:word):byte;
begin
	if (x>319) then Exit;
	if (y>199) then Exit;

	GetPixel:=Mem[Where:pplookup[y]+x];
end;



{ Copy buffer to screen }
Procedure Dump(Src,Dst : word); assembler;
asm
	{ Push stuff }
	push ds

	{ Set source }
	mov ds,[Src]
	xor si,si

	{ Set Dest }
	mov es,[Dst]
	xor di,di

	{ Copy }
	mov cx,125

 @Top:
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
		dw $a566,$a566,$a566,$a566,$a566,$a566,$a566,$a566
	dec cx
	jnz @Top

	{ Pop }
	pop ds
end;



{ Wait for a vertical refresh }
Procedure Waitvlb; assembler;
asm
	mov dx,3DAh
@l1:
	in al,dx
	and al,08h
	jnz @l1
@l2:
	in al,dx
	and al,08h
	jz  @l2
end;



{ Set text mode with error message }
Procedure Error(str : string);
begin
	{ Set text mode }
	TextMode;

	{ Display message }
	Writeln(str);

	Halt;
end;



{ Get current graphics palette }
Procedure GetPalette(var pal : array of byte);
var
	c : integer;
	p : byte;
begin
	{ Get palette info }
	c:=0;

	for p:=0 to 255 do begin
		Port[$3c7]:=p;

		pal[c]:=port[$3c9];
		pal[c+1]:=port[$3c9];
		pal[c+2]:=port[$3c9];

		Inc(c,3);
	end;
end;



{ Set current graphics palette }
Procedure SetPalette(pal : array of byte);
var
	p : integer;
begin
	Port[$3c8]:=0;

	for p:=0 to 767 do begin
		Port[$3c9]:=pal[p];
	end;
end;



{ Set an individual color in the current graphics pallete }
Procedure SetColor(p : integer; r,g,b : byte);
begin
	Port[$3c8]:=p and $ff;

	Port[$3c9]:=r;
	Port[$3c9]:=g;
	Port[$3c9]:=b;
end;



{ SGN for line drawing }
Function SGN(num : integer) : integer;
begin
	if num<0 then
		SGN:=-1
	else
		SGN:=1;
end;



procedure HLine(Where:word;a,b,c:integer;col:byte); assembler;
asm
	{ Check bounds }
	cmp b,0
	jl @Done
	cmp b,199
	jg @Done

	mov bx,a
	mov dx,c

	cmp bx,dx
	jle @NoSwap
	xchg bx,dx
 @NoSwap:

	cmp dx,0
	jl @Done
	cmp bx,319
	jg @Done

	cmp bx,0
	jge @L1
	xor bx,bx
 @L1:
	cmp dx,319
	jle @L2
	mov dx,319
 @L2:

	{ Screen offset }
	lea di,pplookup
	add di,b
	add di,b
	mov di,[ds:di]

	add di,bx

	{ Set dest }
	mov es,[Where]

	{ Write }
	mov AL, Col
	mov AH, AL

	mov CX, dx
	sub CX, bx
	inc CX

	test DI, 1      { Are we on an odd address?  }
	jz @Even
	stosb           { Store the first byte       }
	dec CX          { Decrement the counter one  }
@Even:            { Even address               }
	shr CX, 1       { Do half as many transfers  }
	rep stosw       { Copy all of the even words }
	adc CX, 0       { If there is a pixel left over, set CX to 1 }
	rep stosb       { If there is a pixel left over, fill it!    }

 @Done:
end;



procedure VLine(Where:word;y1,x,y2:integer;col:byte); assembler;
ASM
	{ Check bounds }
	cmp x,0
	jl @Done
	cmp x,319
	jg @Done

	mov bx,y1
	mov dx,y2

	cmp bx,dx
	jle @NoSwap
	xchg bx,dx
 @NoSwap:

	cmp dx,0
	jl @Done
	cmp bx,199
	jg @Done

	cmp bx,0
	jge @L1
	xor bx,bx
 @L1:
	cmp dx,199
	jle @L2
	mov dx,199
 @L2:

	{ Screen offset }
	lea di,pplookup
	add di,bx
	add di,bx
	mov di,[ds:di]
	add di,x

	mov es,[Where]

	{ At this point, DI points to the first pixel in the line.  }
	{ Now we will calculate how many times to loop (Y2-Y1+1)... }

	mov CX, dx
	sub CX, bx      { Calculate the Delta X  }
	inc CX

	cmp cx,1
	jle @Done

	mov AL, Col 	  { Load the color         }

	mov BX, CX
	and BX, 3       { Get remainder of CX DIV 4 }
	shr CX, 2       { Repeated four times    }
	add BX, BX      { Index into a word table}
	jmp WORD PTR CS:[@JumpTable+BX]

@JumpTable:
	dw OFFSET @Iteration5
	dw OFFSET @Iteration4
	dw OFFSET @Iteration3
	dw OFFSET @Iteration2

@Iteration1:
	mov ES:[DI], AL { Set a pixel            }
	add DI, 320      { Increment address      }

@Iteration2:
	mov ES:[DI], AL { Set a pixel            }
	add DI, 320      { Increment address      }

@Iteration3:
	mov ES:[DI], AL { Set a pixel            }
	add DI, 320      { Increment address      }

@Iteration4:
	mov ES:[DI], AL { Set a pixel            }
	add DI, 320      { Increment address      }

@Iteration5:
	dec CX          { Decrement loop counter }
	jns @Iteration1 { Repeat if neccesary    }
 @Done:
END;



Procedure Line(Where:word;a,b,c,d:integer;col:byte);
var
	i,s,d1x,d1y,d2x,d2y,u,v,n:integer;
	Yinc1,Yinc2,ad1,ad2	:	integer;
	m : word;
begin
	if b=d then
		begin
			HLine(Where,a,b,c,col);
			exit;
		end;
	if a=c then
		begin
			VLine(Where,b,a,d,col);
			exit;
		end;

	u:=c-a;
	v:=d-b;
	d1x:=SGN(u);
	d1y:=SGN(v);
	d2x:=d1x;
	d2y:=0;
	m:=ABS(u);
	n:=ABS(v);

	asm
		mov ax,m
		cmp ax,n
		jg @Miss

		mov d2x,0
		push d1y
		pop d2y

		push ax; push n
		pop m; pop n
	 @Miss:
	end;
	ad1:=(320*d1y)+d1x;
	ad2:=(320*d2y)+d2x;
	asm
		{ Work out stuff }
		mov ax,m
		shr ax,1
		mov s,ax

		mov bx,a
		mov dx,b
		mov cx,m

		mov es,Where
		mov di,dx
		shl di,8
		mov ax,dx
		shl ax,6
		add di,ax
		add di,bx

	 @MainLoop:
		{ Check position }
		cmp dx,199; ja @NoPut
		cmp bx,319; ja @NoPut

		{ Put pixel }
		mov al,col; mov es:[di],al
	 @NoPut:

		{ Move }
		mov ax,n
		add s,ax

		mov ax,s
		cmp ax,m
		jl @Part2

		mov ax,m; sub s,ax
		add bx,d1x
		add dx,d1y

		add di,ad1

		dec cx; jns @MainLoop

	 @Part2:
		add bx,d2x
		add dx,d2y

		add di,ad2

		dec cx; jns @MainLoop
	end;
END;



{ Draw a line with <x> many dots in it }
Procedure DotLine(Where : word;x1,y1,x2,y2 : longint;dots : integer;col : byte);
var
	dx,dy,x,y : Longint;
	i : integer;
	s : string;
begin
	{ Get translation vectors }
	dx:=(x2-x1) shl 8;
	dy:=(y2-y1) shl 8;

	dx:=dx div (dots-1);
	dy:=dy div (dots-1);

	{ Draw dots }
	x:=x1 shl 8;
	y:=y1 shl 8;

	for i:=0 to dots-1 do begin
		PutPixel(Where,(x shr 8),(y shr 8),col);

		Inc(x,dx);
		Inc(y,dy);
	end;
end;



{ Is a point on the screen ? }
function OnScreen(x,y : word) : boolean;
begin
	Onscreen:=True;
	if (y>199) or (x>319) then
		begin
			Onscreen:=False;
			Exit;
		end;
end;



{ Dump a sprite block to the screen }
Procedure SpritePut(where:word;x,y:integer;Src:Sprite);
var
	_dx,_dy,w,AddOnX,AddOnY	:	Integer;
begin
	{ Check width }
	if Src.width<=0 then Exit;

	{ Get size }
	_dx:=Src.Width;
	_dy:=Src.Height;
	w:=_dx;

	{ On screen ? }
	if (x>319) or (y>199) then Exit;
	if (y+_dy<0) or (x+_dx<0) then Exit;

	{ Trim }
	if x+_dx>320 then _dx:=320-x;
	if y+_dy>200 then _dy:=200-y;
	if x<0 then
		begin
			AddOnX:=-x;
			x:=0;
			Dec(_dx,AddOnX);
		end
	else
		AddOnX:=0;
	if y<0 then
		begin
			AddOnY:=-y;
			y:=0;
			Dec(_dy,AddOnY);
		end
	else
		AddOnY:=0;

	asm
		push ds

		{ Set Dest }
		mov es,Where
		mov bx,y
		add bx,bx
		mov di,WORD [BX+pplookup]
		add di,x

		{ Set source }
		lds si,Src.Data

		mov ax,AddOnY
		imul w
		add ax,AddOnX
		add si,ax

		{ Pre-calc increments }
		mov ax,_dx

		mov dx,320
		sub dx,ax
		mov bx,w
		sub bx,ax

		mov ax,_dy

		{ Main loop }
	 @Top:
		mov cx,_dx
		shr cx,1
		rep movsw

		mov cx,_dx
		and cx,1
		rep movsb

		add si,bx
		add di,dx

		dec ax
		jnz @Top

		pop ds
	end;
end;



{ Dump a transparant sprite block to the screen }
Procedure TSpritePut(where:word;x,y:integer;Src:Sprite);
var
	i,j	:	Integer;
	Bit	:	Byte;
	_dx,_dy,w,AddOnX,AddOnY	:	Integer;
begin
	{ Check width }
	if Src.width<=0 then Exit;

	{ Get size }
	_dx:=Src.Width;
	_dy:=Src.Height;
	w:=_dx;

	{ On screen ? }
	if (x>319) or (y>199) then Exit;
	if (y+_dy<0) or (x+_dx<0) then Exit;

	{ Trim }
	if x+_dx>320 then _dx:=320-x;
	if y+_dy>200 then _dy:=200-y;
	if x<0 then
		begin
			AddOnX:=-x;
			x:=0;
			Dec(_dx,AddOnX);
		end
	else
		AddOnX:=0;
	if y<0 then
		begin
			AddOnY:=-y;
			y:=0;
			Dec(_dy,AddOnY);
		end
	else
		AddOnY:=0;

	{ Display a segment }
	for i:=0 to _dy-1 do
			asm
				push ds

				{ Set Dest }
				mov es,Where
				mov bx,y
				add bx,bx
				mov di,WORD [BX+pplookup]
				add di,x

				{ Set Source }
				lds si,Src.Data
				mov ax,AddOnY
				imul w
				add ax,AddOnX
				add si,ax

				{ Write byte }
				mov cx,_dx
			 @Top:
				lodsb
				test ax,$00ff
				jz @MissIt

				stosb
				jmp @OK

			 @MissIt:
				inc di

			 @OK:
				dec cx
				jnz @Top

				inc y
				inc AddOnY

				pop ds
			end;
end;



{ Dump a transparant sprite block to the screen in a certain color }
Procedure TPaintPut(where:word;x,y:integer;Src:Sprite;Col:word);
var
	i,j	:	Integer;
	Bit	:	Byte;
	_dx,_dy,w,AddOnX,AddOnY	:	Integer;
begin
	{ Check width }
	if Src.width<=0 then Exit;

	{ Get size }
	_dx:=Src.Width;
	_dy:=Src.Height;
	w:=_dx;

	{ On screen ? }
	if (x>319) or (y>199) then Exit;
	if (y+_dy<0) or (x+_dx<0) then Exit;

	{ Trim }
	if x+_dx>320 then _dx:=320-x;
	if y+_dy>200 then _dy:=200-y;
	if x<0 then
		begin
			AddOnX:=-x;
			x:=0;
			Dec(_dx,AddOnX);
		end
	else
		AddOnX:=0;
	if y<0 then
		begin
			AddOnY:=-y;
			y:=0;
			Dec(_dy,AddOnY);
		end
	else
		AddOnY:=0;

	{ Display a segment }
	for i:=0 to _dy-1 do
			asm
				push ds

				{ Set Dest }
				mov es,Where
				mov bx,y
				add bx,bx
				mov di,WORD [BX+pplookup]
				add di,x

				{ Set Source }
				lds si,Src.Data
				mov ax,AddOnY
				imul w
				add ax,AddOnX
				add si,ax

				{ Write byte }
				mov cx,_dx
			 @Top:
				lodsb
				test ax,$00ff
				jz @MissIt

				mov ax,col
				stosb
				jmp @OK

			 @MissIt:
				inc di

			 @OK:
				dec cx
				jnz @Top

				inc y
				inc AddOnY

				pop ds
			end;
end;



{ Hey... Guess what? This function makes a 'beeping' sound! :}
Procedure Beep;
begin
	Sound(500);        { Beep }
	Delay(200);        { For 200 ms }
	NoSound;           { Relief! }
end;



{ Draw empty polygon with 'n' lines }
Procedure PolygonN(Where:word;x,y:Array of integer;num:integer;Col:byte);
var
	i : integer;
begin
	for i:=0 to num-2 do
		Line(Where,x[i],y[i],x[i+1],y[i+1],Col);

	Line(Where,x[0],y[0],x[num-1],y[num-1],Col);
end;



{ Draw 4 line empty polygon }
Procedure Polygon(Where:word;x1,y1,x2,y2,x3,y3,x4,y4:integer;Col:Byte);
begin
	Line(Where,x1,y1,x2,y2,Col);
	Line(Where,x2,y2,x3,y3,Col);
	Line(Where,x3,y3,x4,y4,Col);
	Line(Where,x4,y4,x1,y1,Col);
end;



{ Guess }
Procedure FreeSprite(var a : sprite);
begin
	if a.width<1 then exit;
	if a.height<1 then exit;
	if a.width*a.height=0 then Exit;

	Freemem(a.data,(a.width*a.height)+10);

	if CreatePalette then
		Freemem(a.palette,768);
end;



{ Guess }
Procedure GetSpriteMem(var a : sprite);
begin
	A.Data:=MemAllocSeg((a.width*a.height)+10);

	if CreatePalette then
		Getmem(a.palette,768);
end;



{ Tile a sprite }
Procedure Tile(Where:word;a:Sprite);
var
	x,y : integer;
begin
	x:=0;
	y:=0;

	repeat
		repeat
			SpritePut(Where,x,y,a);
			Inc(x,a.width);
		until x>319;

		x:=0;
		Inc(y,a.Height);
	until y>199;
end;



{ Draw a rectangle }
procedure Rectangle(where:word;x1,y1,x2,y2:integer;col:byte);
begin
	HLine(vAddr,x1,y1,x2,col);
	HLine(vAddr,x1,y2,x2,col);
	VLine(vAddr,y1,x1,y2,col);
	VLine(vAddr,y1,x2,y2,col);
end;



{ Draw a filled rectangle }
procedure SolidRectangle(where:word;x1,y1,x2,y2:integer;col:byte);
var
	dOff : word;
	i,count : integer;

	width,height : integer;
begin
	{ Trim }
	if x1<0 then x1:=0;
	if y1<0 then y1:=0;

	{ Get size }
	width:=x2-x1+1;
	height:=y2-y1+1;

	if (width<1) or (height<1) then Exit;

	{ Check size }
	if not OnScreen(x1,y1) then
		Exit;
	if width<=0 then
		Exit;
	if height<=0 then
		Exit;

	{ Clip a bit }
	if y1+height-1>199 then
		height:=200-y1;

	if x1+width-1>319 then
		count:=320-x1
	else
		count:=width;

	{ Set offsets }
	dOff:=ppLookup[y1]+x1;

	{ Put block }
	for i:=1 to height do begin
		asm
			{ Set dest }
			mov es,where
			mov di,dOff

			{ Write bytes }
			mov cx,count
			mov al,col
			rep stosb
		end;

		{ Adjust offsets }
		Inc(dOff,320);
	end;
end;



Function Rad(x:integer) : integer;
begin
	Rad:=round(x*0.01745);
end;



Procedure Wait(num:integer);
var
	i	:	integer;
begin
	if num<=0 then exit;

	for i:=0 to num do WaitVLB;
end;



procedure Closegraph;
begin
	Textmode;
end;


{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}


procedure PutPixelX(x,y:integer;color:byte); assembler;
asm
	{ Check video mode }
	cmp VideoMode,VGAx
	jne @Okay

	{ Check bounds }
	mov ax,x
	mov cx,y

	cmp ax,0
	jl @Okay
	cmp ax,319
	jg @Okay

	cmp cx,0
	jl @Okay
	cmp cx,scrnheight
	jge @Okay

	{ Screen offset }
	lea di,pplookup
	add di,cx
	add di,cx
	mov di,[ds:di]

	{ Place pixel }
	push ds
	mov cx,ax                  { And in cx                            }
	shr ax,2                   { Divide ax by 4  (x div 4)            }
	add di,ax                  { Y:=Y+X   bx contains final location  }
	add di,actStart

	and cx,3             	   	 { cl:=0,1,2 or 3  (x mod 4)            }
	mov ah,1             	   	 { Start value (plane 0)                }
	shl ah,cl                  { Eg plane 2: 00000001 => 00000100     }
	mov dx,$03c4                { Sequencer Register                   }
	mov al,2                   { Select index 2 => plane enable       }
	out dx,ax                  { Enable selected plane                }
	mov ax,$a000
	mov es,ax	                 { es points to VGA                     }
	mov al,color               { Color in al                          }
	stosb
	pop ds

 @Okay:
end;



function GetPixelX(pg:byte;x,y:integer):byte;
var
	p	:	word;
	r	:	byte;
begin
	p:=pg*actStart;

	asm
		{ Get y into ax }
		mov ax,y
		shl ax,6
		shl y,4
		add ax,y

		{ Get x into bx }
		mov bx,x
		mov cx,x
		shr bx,2

		{ Get offset into bx }
		add bx,ax
		add bx,p

		{ Read pixel }
		mov al,4
		mov ah,cl
		and ah,3

		mov dx,$03ce
		out dx,ax

		xor ah,ah
		mov al,es:[bx]

		mov R,al
	end;

	GetPixelX:=r;
end;



procedure CopyPageX(srce,dest:byte);
var
	a,b,c	:	word;
	l	:	byte;
begin
	{ Return if error }
	if srce=dest then Exit;

	{ Get address offsets }
	a:=srce*80*scrnheight;
	b:=dest*80*scrnheight;

	{ Set counter }
	c:=80*scrnheight;

	{ Copy screen }
	for l:=0 to 3 do
		asm
			{ Set write plane }
			mov al,2
			mov dx,$3c4
			out dx,al
			mov al,1
			xor cx,cx
			mov cl,l
			rep shl al,cl
			inc dx
			out dx,al

			{ Set read plane }
			mov al,4
			mov ah,l
			mov dx,$03ce
			out dx,ax

			{ Push registers }
			push ds

			{ Set ds and es }
			mov ax,$a000
			mov ds,ax
			mov es,ax

			{ Set offsets }
			mov si,a
			mov di,b

			{ Write bytes }
			mov cx,c
			rep movsb

			{ Pop registers }
			pop ds
		end;
end;



procedure ModeX;
var
	i	:	Integer;
begin
	{ Check mode }
	if VideoMode=VGAn then
		FreeMem(vscreen,64000);

	{ Set variables }
	ActStart:=0;
	scrnheight:=200;
	VideoMode:=VGAx;

	{ Set 320x200x256 unchained }
	asm
		mov ax,$13
		int $10

		{ Set chain-4 off }
		mov dx,$3C4
		mov ax,$604
		out dx,ax

		{ Clear video display }
		mov ax,$F02
		out dx,ax
		mov dx,$A000
		mov es,dx
		xor di,di
		xor ax,ax
		mov cx,$8000
		rep stosw

		{ Turn off CRTC's long mode }
		mov dx,$03D4
		mov ax,$14
		out dx,ax

		{ Turn on the CRTC's BYTE mode }
		mov ax,$E317
		out dx,ax
	end;

	for i:=0 to 399 do
		ppLookup[i]:=80*i;
end;



procedure ModeX400;
begin
	ModeX;
	scrnheight:=400;

	{ Double resolution to 320x400x256 }
	asm
		mov dx,$3d4
		mov ax,$4009
		out dx,ax
	end;
end;




procedure ModeX240;
begin
	ModeX;

	{ Set resolution to 320x240x256 }
	asm
		mov dx,$3c2
		mov al,$e3
		out dx,al

		mov dx,$3d4

		mov ax,$2c11
		out dx,ax
		mov ax,$0d06
		out dx,ax
		mov ax,$3e07
		out dx,ax
		mov ax,$ea10
		out dx,ax
		mov ax,$ac11
		out dx,ax
		mov ax,$df12
		out dx,ax
		mov ax,$e715
		out dx,ax
		mov ax,$0616
		out dx,ax

		mov ScrnHeight,240
	end;
end;



procedure SetActiveX(page:integer);
begin
	actStart:=(page*80*scrnheight);
end;



procedure SetVisualX(page:integer);
var
	num	:	word;
begin
	num:=page*80*scrnheight;

	asm
		mov dx,$3d4
		mov al,$0c
		out dx,al

		inc dx
		mov ax,num
		shr ax,8
		out dx,al

		dec dx
		mov al,$0d
		out dx,al

		inc dx
		mov ax,num
		out dx,al
	end;
end;



procedure SetWritePlaneX(plane:byte); assembler;
asm
	{ Set write plane }
	mov al,2
	mov dx,$3c4
	out dx,al
	mov al,1
	xor cx,cx
	mov cl,plane
	and cl,3
	rep shl al,cl
	inc dx
	out dx,al
end;



procedure SetReadPlaneX(plane:byte); assembler;
asm
	mov al,4
	mov ah,plane
	and ah,3

	mov dx,$3ce
	out dx,ax
end;



procedure SetAllPlanesX; assembler;
asm
		mov dx,$3c4
		mov ax,$f02
		out dx,ax
end;



procedure HLineX(y,x1,x2:integer;color:byte);
var
	off			:	word;
	i,pos,w	:	integer;
label
	Done;
begin
	off:=ppLookup[y];

	pos:=x1;

	for i:=x1 to x2 do
		if (i mod 4)<>0 then
			asm
				mov ax,i                   { Move X-value into ax                 }
				mov cx,ax                  { And in cx                            }
				shr ax,2                   { Divide ax by 4  (x div 4)            }
				mov di,off
				add di,ax                  { Y:=Y+X   bx contains final location  }
				add di,actStart

				and cx,3             	   { cl:=0,1,2 or 3  (x mod 4)              }
				mov ah,1             	   { Start value (plane 0)                  }
				shl ah,cl                  { Eg plane 2: 00000001 => 00000100     }
				mov dx,$3c4                { Sequencer Register                   }
				mov al,2                   { Select index 2 => plane enable       }
				out dx,ax                  { Enable selected plane                }
				mov ax,$a000              { VGA segment                          }
				mov es,ax                  { es points to VGA                     }
				mov al,color               { Color in al                          }
				stosb

				inc pos
			end
		else
			goto Done;

 Done:

	{ Middle bit }
	w:=x2-pos+1;
	i:=w shr 3;
	asm
		{ Set planes }
		mov dx,$3c4
		mov ax,$0f02
		out dx,ax

		{ Draw line }
		mov ax,$a000
		mov es,ax

		mov di,off
		add di,actStart

		mov ax,pos
		shr ax,2
		add di,ax

		mov al,color
		mov ah,color

		mov cx,i
		rep stosw
	end;
	Inc(pos,i shl 3);

	{ End bit }
	for i:=pos to x2 do
		asm
			mov ax,i                   { Move X-value into ax                 }
			mov cx,ax                  { And in cx                            }
			shr ax,2                   { Divide ax by 4  (x div 4)            }
			mov di,off
			add di,ax                  { Y:=Y+X   bx contains final location  }
			add di,actStart

			and cx,3             	   { cl:=0,1,2 or 3  (x mod 4)              }
			mov ah,1             	   { Start value (plane 0)                  }
			shl ah,cl                  { Eg plane 2: 00000001 => 00000100     }
			mov dx,3c4h                { Sequencer Register                   }
			mov al,2                   { Select index 2 => plane enable       }
			out dx,ax                  { Enable selected plane                }

			mov ax,$a000              { VGA segment                          }
			mov es,ax                  { es points to VGA                     }
			mov al,color               { Color in al                          }
			stosb
		end;
end;



procedure SpritePutX(x,y:integer;srce:sprite);
var
	nd,cut,a	:	integer;
	plane,temp	:	byte;
	p,s,dest,off	:	word;
begin
	p:=0;
	cut:=0;
	nd:=y+Srce.height;

	{ Check position }
	if (y>=scrnheight) or (nd<0) then Exit;
	if (x<0) or (x>319) then Exit;
	if y<0 then
		begin
			p:=-y*srce.width;
			y:=0;
		end;

	if nd>scrnheight then
		nd:=scrnheight;

	if x+srce.width>319 then
		cut:=x+srce.width-320;

	{ Draw block }
	for a:=y to nd-1 do
		begin
			{ Draw line }
			off:=(a*80)+actStart;
			for plane:=0 to 3 do
				begin
					dest:=off+(x shr 2);
					SetWritePlaneX(x);
					Inc(x);
					s:=plane;

					while s<srce.width-cut do
						begin
							temp:=Mem[seg(srce.data^):ofs(srce.data^)+p+s];
							asm
								mov ax,$a000
								mov es,ax
								mov di,dest
								mov al,temp

								stosb

								add s,4
								inc dest
							end;
						end;
				end;

			Dec(x,4);
			Inc(p,srce.width);
		end;
end;



procedure SolidRectangleX(left,top,right,bottom:integer;color:byte);
var
	i	: integer;
begin
	{ Check position }
	if right<left then
		asm
			push right
			push left
			pop right
			pop left
		end;

	if bottom<top then
		asm
			push top
			push bottom
			pop top
			pop bottom
		end;

	if (left<0) or (top<0) or (left>319) or (top>=scrnheight) then Exit;

	{ Sort out height and width }
	if bottom>scrnheight then
		bottom:=scrnheight;
	if right>=320 then
		right:=319;

	{ Draw block }
	for i:=top to bottom do
		HLineX(i,left,right,color);
end;



procedure ClsX(color:byte);
var
	c	:	word;
begin
	c:=20*scrnheight;

	asm
		{ Select all planes }
		mov dx,$3c4
		mov ax,$0f02
		out dx,ax

		{ Write color }
		mov dx,$a000
		mov es,dx

		mov di,ActStart

		mov cx,c
		mov ah,color
		mov al,color
		db $66; shl ax,16
		mov ah,color
		mov al,color

		rep; db $66; stosw
	end;
end;



procedure LineX(a,b,c,d:integer;color:byte);
var
	i,s,d1x,d1y,d2x,d2y,u,v,m,n,addr	:	Integer;
label
	NotOK;
begin
	asm
		{ Check boundries }
		cmp a,0
		jl NotOK
		cmp a,319
		jg NotOK

		cmp c,0
		jl NotOK
		cmp c,319
		jg NotOK

		cmp b,0
		jl NotOK
		cmp d,0
		jl NotOK

		mov ax,ScrnHeight
		cmp b,ax
		jge NotOK
		cmp d,ax
		jge NotOK

		{ Set initial write plane }
		mov al,2
		mov dx,$3c4
		out dx,al
		mov al,1
		mov cx,a
		and cl,3
		rep shl al,cl
		inc dx
		out dx,al

		{ Get u and v }
		mov ax,c
		sub ax,a
		mov u,ax

		mov ax,d
		sub ax,b
		mov v,ax
	end;

	{ Work out absolutes }
	m:=abs(u);
	n:=abs(v);

	asm
		{ Get sign for d1x }
		cmp u,0
		je @Zero1
		jl @Neg1

		mov d1x,1
		jmp @Done1

	 @Zero1:
		mov d1x,0
		jmp @Done1

	 @Neg1:
		mov d1x,-1

	 @Done1:

		{ Get sign for d1y }
		cmp v,0
		je @Zero2
		jl @Neg2

		mov d1y,1
		jmp @Done2

	 @Zero2:
		mov d1y,0
		jmp @Done2

	 @Neg2:
		mov d1y,-1

	 @Done2:

		{ More gradient stuff }
		push d1x
		pop d2x
		mov d2y,0

		{ Compare m and n }
		mov ax,m
		cmp ax,n
		jg @DontDoIt

		push d1y
		pop d2y
		mov d2x,0

		push m
		push n
		pop m
		pop n
	 @DontDoIt:

		{ Draw the line }
		mov ax,m
		shr ax,1
		mov s,ax

		mov i,0
		mov addr,$a000

	 @LoopStart:

		{ Put pixel }
		mov ax,b
		mov bx,80
		mul bx
		mov di,ax

		mov ax,a
		shr ax,2
		add di,ax
		add di,ActStart
		mov es,addr

		mov al,color
		stosb

		mov ax,n
		add s,ax

		{ Advance to next pixel }
		mov ax,s
		cmp ax,m
		jl @LessThan

		mov bx,m
		mov ax,d1x
		mov cx,d1y

		sub s,bx
		add a,ax
		add b,cx
		jmp @PlaneCheck

	 @LessThan:
		mov ax,d2x
		mov bx,d2y
		add a,ax
		add b,bx

	 @PlaneCheck:
		cmp ax,0
		jz @Missit

		{ Set write plane }
		mov al,2
		mov dx,$3c4
		out dx,al

		mov al,1
		mov cx,a
		and cl,3
		shl al,cl

		inc dx
		out dx,al
	 @Missit:

		{ Loop }
		inc i
		mov ax,m
		cmp i,ax
		jle @LoopStart
	end;
 NotOK:
	Exit;
end;



procedure UpdateAreaX(p1,p2:byte;left,top,right,bottom:integer);
var
	soff,doff,ptr,sof,dof,height	:	word;
	plane,p	:	Integer;
begin
	{ Clip areas }
	if left<0 then left:=0;
	if left>319 then left:=319;
	if right<0 then right:=0;
	if right>319 then right:=319;
	if top<0 then top:=0;
	if top>=scrnheight then top:=scrnheight-1;
	if bottom<0 then bottom:=0;
	if bottom>=scrnheight then bottom:=scrnheight-1;

	{ Check ranges }
	if left>right then
		asm
			push left
			push right
			pop left
			pop right
		end;
	if top>bottom then
		asm
			push top
			push bottom
			pop top
			pop bottom
		end;

	{ Set pointers }
	soff:=(80*p1*scrnheight)+(80*top);
	doff:=(80*p2*scrnheight)+(80*top);
	height:=bottom-top+1;

	{ Draw line }
	for plane:=0 to 3 do
		begin
			SetReadPlaneX(left+plane);
			SetWritePlaneX(left+plane);

			p:=left+plane;
			while p<=right do
				begin
					ptr:=p shr 2;
					sof:=soff+ptr;
					dof:=doff+ptr;

					asm
						push ds

						mov ax,$a000
						mov ds,ax
						mov es,ax

						{ Loop }
						mov cx,height

					 @loop1:

						mov si,sof
						mov di,dof

						movsb
						add sof,80
						add dof,80

						loop @loop1

						pop ds
					end;

					Inc(p,4);
				end;
		end;
end;



Procedure PolygonX(x1,y1,x2,y2,x3,y3,x4,y4:integer;Col:Byte);
begin
	LineX(x1,y1,x2,y2,Col);
	LineX(x2,y2,x3,y3,Col);
	LineX(x3,y3,x4,y4,Col);
	LineX(x4,y4,x1,y1,Col);
end;


{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}


Procedure TranslatePCX(Dest:sprite;ss,so:word;Size:word);
var
	j,RunLen :integer;
	b : byte;
	i,ds,dof,idof : word;
begin
	ds:=seg(Dest.data^);
	dof:=ofs(Dest.data^);
	idof:=dof;

	for i:=1 to Size do begin
		{ Read character }
		b:=Mem[ss:so];
		Inc(so);

		{ Get repeat length }
		if b>$C0 then begin
			RunLen:=b and $3F;

			{ Get character to repeat }
			b:=Mem[ss:so];
			Inc(so);
		end else
			RunLen:=1;

		{ Write bytes }
		for j:=1 to RunLen do begin
			if dof-idof<Size then begin
				Mem[ds:dof]:=b;
				Inc(dof);
			end;
		end;
	end;
end;


{----------------------------------------------------------------------------}


Function SpriteLoadPCX(filename:string;var dest:Sprite) : boolean;
var
	FileHandle : file;
	p : integer;
	size : word;

	Data : VirtPtr;
begin
	{ Open file }
	{$I-}
	Assign(FileHandle, filename);
	Reset(FileHandle,1);
	{$I+}

	{ Error check }
	if (IOresult<>0) then begin
		SpriteLoadPCX:=False;
		Exit;
	end;

	{ Check length of file }
	if FileSize(FileHandle)>65528 then begin
		SpriteLoadPCX:=False;
		Exit;
	end;

	{ Grab memory }
	if MaxAvail<Size+4096 then
		Error('Not enough memory for sprite allocation.');
	Size:=FileSize(FileHandle);
	Data:=MemAllocSEG(Size);

	{ Skip header }
	Seek(FileHandle,128);

	{ Read data and close }
	BlockRead(FileHandle,Data^,Size-128);
	Close(FileHandle);

	{ Get size of pixture) }
	if not GetPCXInfo(filename,dest.width,dest.height) then
		begin
			SpriteLoadPCX:=False;
			Exit;
		end;
	GetSpriteMem(Dest);

	{ Decode data to new memory address }
	TranslatePCX(Dest,seg(Data^),ofs(Data^),dest.width*dest.height);

	{ Load palette and adjust to VGA }
	if CreatePalette then
		for p:=0 to 767 do
			Dest.palette^[p]:=Mem[seg(Data^):ofs(Data^)+(Size-896+p)] shr 2;

	SpriteLoadPCX:=True;

	{ Free data memory }
	Freemem(Data,Size);
end;


{----------------------------------------------------------------------------}


Function GetPCXInfo(filename:string;var width,height:integer) : boolean;
type
	pHeader=^PCXHeader;
	PCXHeader=RECORD
		id : byte;
		ver : byte;
		compressed : boolean;
		bitpixel : byte;
		minx,miny,maxx,maxy : word;
		xsize,ysize : word;
		palette : array[1..48] of byte;
		unknown : byte;
		depth : byte;
	end;

var
	FileHandle : file;
	Data : VirtPtr;
	Info : pHeader;
begin
	{ Open PCX file }
	{$I-}
	Assign(FileHandle,filename);
	Reset(FileHandle,1);
	{$I+}

	{ Error check }
	if (IOresult<>0) then begin
		GetPCXInfo:=False;
		Exit;
	end;

	{ Read header }
	Getmem(Data,Sizeof(PCXHeader));
{	Data:=MemAllocSEG(Sizeof(PCXHeader));}
	BlockRead(FileHandle,Data^,Sizeof(PCXHeader));
	Close(FileHandle);

	{ Check signature }
	Info:=pHeader(Data);

	with Info^ do begin
		if (id<>$0A) OR (NOT compressed) then begin
			Freemem(Data,Sizeof(PCXHeader));
			GetPCXInfo:=False;
			Exit;
		end;

		if (bitpixel<>8) OR (depth<>$01) OR (ver<>5) then begin
			Freemem(Data,Sizeof(PCXHeader));
			GetPCXInfo:=False;
			Exit;
		end;
	end;

	{ Get size }
	width:=Info^.maxx+1;
	height:=Info^.maxy+1;

	Freemem(Data,Sizeof(PCXHeader));

	GetPCXInfo:=True;
end;


{----------------------------------------------------------------------------}


Function LoadPCXPalette(filename:string;var dest:Array of byte) : boolean;
var
	FileHandle : file;
	p : integer;
	size : word;

	Data : VirtPtr;
begin
	{ Open file }
	{$I-}
	Assign(FileHandle, filename);
	Reset(FileHandle,1);
	{$I+}

	{ Error check }
	if (IOresult<>0) then begin
		LoadPCXPalette:=False;
		Exit;
	end;

	{ Check length of file }
	Size:=FileSize(FileHandle);
	if Size>65528 then begin
		LoadPCXPalette:=False;
		Exit;
	end;

	{ Grab memory }
	Getmem(Data,Size);
{	Data:=MemAllocSEG(Size);}

	{ Read data and close }
	Seek(FileHandle,128);
	BlockRead(FileHandle,Data^,Size-128);
	Close(FileHandle);

	{ Load palette and adjust to VGA }
	for p:=0 to 767 do
		Dest[p]:=Mem[seg(Data^):ofs(Data^)+(Size-896+p)] shr 2;

	LoadPCXPalette:=True;

	{ Free data memory }
	Freemem(Data,Size);

{	dest[0]:=10;}
end;


{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}
{----------------------------------------------------------------------------}

var
	i	:	Word;
begin
	CreatePalette:=True;

	{ Make lookup table }
	for i:=0 to 199 do
		pplookup[i]:=i*320;
end.