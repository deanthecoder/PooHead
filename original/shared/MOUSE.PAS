unit Mouse;

interface

uses crt;

type
	Mouse_s=record
		lmb,rmb,lmr,rmr : byte;
		mx,my : integer;
	end;

var
	M : Mouse_s;

{ Procedure definitions }
function Minit : byte;
procedure MShow;
procedure MHide;
procedure MCheck;
procedure GetMouseClick;
procedure limitmouse(x1,y1,x2,y2 : integer);
procedure SetMouseXY(x,y : integer);

implementation

function Minit : byte;
var
	ret : byte;
begin
	asm
		xor ax,ax
		int $33
		mov ret,ah
	end;

	Delay(50);

	Minit:=ret;
end;



procedure MShow; assembler;
asm
	mov ax,1
	int $33
end;



procedure MHide; assembler;
asm
	mov ax,2
	int $33
end;



procedure MCheck;
var
	mx,my : integer;
	lmb,lmr,rmb,rmr : byte;
begin
	asm
		mov ax,$0003
		int $33

		mov mx,cx
		mov my,dx

		mov dl,bl
		and dl,1
		mov lmb,dl

		mov dl,bl
		and dl,2
		mov rmb,dl

		mov ax,$0006
		mov bx,$0000
		int $33
		mov lmr,bl

		mov ax,$0006
		mov bx,$0001
		int $33
		mov rmr,bl
	end;

	m.mx:=mx;
	m.my:=my;
	m.lmb:=lmb;
	m.rmb:=rmb;
	m.lmr:=lmr;
	m.rmr:=rmr;
end;



procedure GetMouseClick;
begin
	repeat
		MCheck;
	until (m.lmr<>0) or (m.rmr<>0);
end;



procedure limitmouse(x1,y1,x2,y2 : integer);
begin
	asm
		mov ax,7
		mov cx,x1
		mov dx,x2
		int $33

		mov ax,8
		mov cx,y1
		mov dx,y2
		int $33
	end;

	mcheck;
end;



procedure SetMouseXY(x,y : integer);
begin
	asm
		mov ax,4
		mov cx,x
		mov dx,y

		int $33
	end;

	m.mx:=x;
	m.my:=y;
end;

end.